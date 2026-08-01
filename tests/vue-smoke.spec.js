const { test, expect } = require('@playwright/test');
const fs = require('fs/promises');

function emptyData(overrides = {}) {
    return {
        records: [], todos: [], habits: [], checkins: [], habitPointLedger: [], habitRewards: [], habitCurrencies: [], templates: [], goals: [], deletedItems: [], materials: [], bodyMetrics: [], fitnessPlans: [], fitnessWorkouts: [], exerciseLibrary: [], wheels: [], wheelTags: [], wheelLibraryItems: [], wheelHistory: [], ...overrides
    };
}

function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

function habitRemoteSnapshot(overrides = {}) {
    return {
        schemaVersion: 1,
        habits: [],
        habitGroups: [],
        habitRecords: [],
        habitRewards: [],
        habitRewardRecords: [],
        habitFineRecords: [],
        habitLedger: [],
        habitCurrencies: [],
        habitMilestones: [],
        habitMilestoneClaims: [],
        habitOverdueEvents: [],
        habitMoodNotes: [],
        habitTimeTasks: [],
        deletedItems: [],
        ...overrides,
    };
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
    for (const [label, title] of [['所有记录', '所有记录'], ['灵感池', '灵感池'], ['素材库', '素材库'], ['标签中心', '标签中心'], ['全局搜索', '全局搜索'], ['待办总览', '待办总览'], ['习惯打卡', '习惯中心'], ['运动健身', '运动健身'], ['目标管理', '目标管理'], ['工具转盘', '工具转盘'], ['AI 助手', 'AI 助手'], ['云同步', '云同步']]) {
        const entry = ['AI 助手', '云同步'].includes(label)
            ? page.getByRole('button', { name: label })
            : page.getByRole('link', { name: label });
        await entry.click();
        await expect(page.locator('.page-title')).toHaveText(title);
    }
    expect(errors).toEqual([]);
});

test('todo writes main data and the compatible todo mirror', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/todos');
    await page.getByRole('button', { name: /新建.*待办/ }).click();
    await page.locator('#page-todos input[required]').fill('Vue 待办');
    await page.getByRole('button', { name: '保存待办' }).click();
    await expect(page.locator('.todo-table')).toContainText('Vue 待办');
    const stored = await page.evaluate(() => ({ data: JSON.parse(localStorage.getItem('lifePlanData')), mirror: JSON.parse(localStorage.getItem('todoAppData')) }));
    expect(stored.data.todos).toHaveLength(1);
    expect(stored.data.todos[0].text).toBe('Vue 待办');
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.mirror.todos[0].text).toBe('Vue 待办');
});

test('todo create form exposes legacy date range presets', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/todos');
    await page.getByRole('button', { name: /新建.*待办/ }).click();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    const create = page.locator('#todo-create-panel');
    await create.getByLabel('任务').fill('带计划日期的 Vue 待办');
    await create.getByRole('button', { name: '明天', exact: true }).click();
    await expect(create.getByLabel('计划开始')).toHaveValue(tomorrowDate);
    await expect(create.getByLabel('计划结束')).toHaveValue(tomorrowDate);
    await expect(create.getByLabel('截止日期')).toHaveValue(tomorrowDate);
    await create.getByRole('button', { name: '保存待办' }).click();

    const stored = await page.evaluate(() => ({ data: JSON.parse(localStorage.getItem('lifePlanData')), mirror: JSON.parse(localStorage.getItem('todoAppData')) }));
    expect(stored.data.todos[0]).toMatchObject({
        text: '带计划日期的 Vue 待办', planStartDate: tomorrowDate, planEndDate: tomorrowDate, dueDate: tomorrowDate,
    });
    expect(stored.mirror.todos[0]).toMatchObject({ planStartDate: tomorrowDate, planEndDate: tomorrowDate, dueDate: tomorrowDate });
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
    await expect(detail.locator('section[aria-labelledby="todo-sessions-heading"]')).toContainText('还没有执行记录。做了一段就记一次，时间轴会按这里显示。');
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
    await page.getByLabel('待办模式').selectOption('exclusive');
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

test('todo page keeps the legacy cloud sync panel below the workspace', async ({ page }) => {
    const source = emptyData({
        todos: [{ id: 'todo-sync-shell', text: '同步位置待办', done: false, group: '其他', subTodos: [], sessions: [] }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/todos');

    const workspace = page.locator('.todo-workspace');
    const syncPanel = page.locator('.todo-sync-card');
    await expect(syncPanel).toBeVisible();
    await expect(page.locator('.todo-detail-placeholder')).toHaveCount(0);
    await expect(syncPanel).toContainText('待办独立同步');
    await expect(syncPanel).toContainText('/apps/todo-app/data.json');
    expect(await syncPanel.evaluate(node => node.getBoundingClientRect().top)).toBeGreaterThan(await workspace.evaluate(node => node.getBoundingClientRect().top));
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('todo detail overdue status mirrors legacy and clears after completion', async ({ page }) => {
    const today = localDate();
    const yesterdayDate = new Date(`${today}T12:00:00`);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = localDate(yesterdayDate);
    const source = emptyData({
        todos: [todoFixture('todo-overdue-detail', '昨天截止的待办', { dueDate: yesterday, urgency: 'high' })],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/todos?todo=todo-overdue-detail');
    const detail = page.locator('.todo-detail-panel');
    await expect(detail).toContainText('已超期 1 天');
    await expect(detail).not.toContainText('未完成');
    await detail.getByRole('button', { name: '标记完成', exact: true }).click();
    await expect(detail).toContainText('已完成');
    await expect(detail).not.toContainText('已超期 1 天');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).not.toBe(original);
});

test('todo dashboard route presets and calendar entries preserve one read-only detail target', async ({ page }) => {
    const today = localDate();
    const tomorrow = new Date(`${today}T12:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = localDate(tomorrow);
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
    await expect(detail.locator('section[aria-labelledby="todo-records-heading"]')).toContainText('暂无关联记录');
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
        await page.getByRole('button', { name: '日视图', exact: true }).click();
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

test('todo urgency filter treats missing legacy urgency as medium', async ({ page }) => {
    const source = emptyData({
        todos: [todoFixture('todo-missing-urgency', '缺失紧急度的旧待办', { urgency: undefined })],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/todos');

    const rows = page.locator('.todo-table tbody tr');
    await page.getByLabel('待办紧急度').selectOption('medium');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('缺失紧急度的旧待办');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('todo table keeps a legacy empty task title blank', async ({ page }) => {
    const source = emptyData({
        todos: [todoFixture('todo-empty-text', '', { group: '其他' })],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);

    await page.goto('/#/todos');
    const row = page.locator('.todo-table tbody tr').filter({ has: page.locator('input[aria-label="完成 "]') });
    await expect(row.locator('.todo-title-cell')).toHaveText(/执行 0 次/);
    await expect(row.locator('.todo-title-cell')).not.toContainText('未命名待办');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
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
    await expect(page.locator('.hero-date')).toHaveText(/^\d{4}年\d{1,2}月\d{1,2}日$/);
    await expect(page.locator('.summary-card').filter({ hasText: '今日待办' })).toContainText('1/4');
    await expect(page.locator('.hero-meta')).toContainText('近30天训练 0');
    await expect(page.locator('.hero-meta')).toContainText('连续训练 0 天');
    await expect(page.locator('.summary-card').filter({ hasText: '习惯完成' })).toContainText('1/1');
    await expect(page.locator('.summary-card').filter({ hasText: '进行目标' })).toContainText('1');
    const commandMetrics = page.locator('.command-metric');
    await expect(commandMetrics.filter({ hasText: '未处理灵感' })).toContainText('1');
    await expect(commandMetrics.filter({ hasText: '待写结论' })).toContainText('1');
    await expect(commandMetrics.filter({ hasText: '高压待办' })).toContainText('1');
    await expect(page.locator('.dashboard-timeline')).toContainText('Dashboard 日记记录');
    await expect(page.locator('.dashboard-timeline')).toContainText(/\d{4}年\d{1,2}月\d{1,2}日/);
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
    await page.locator('.dashboard-timeline').getByRole('button', { name: /Dashboard 习惯/ }).click();
    await expectHashRoute(page, '/habits', { habit: 'habit-dashboard' });

    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: /Dashboard 目标/ }).click();
    await expectHashRoute(page, '/goals', { goal: 'goal-dashboard' });

    const persisted = await page.evaluate(() => ({ data: localStorage.getItem('lifePlanData'), mirror: localStorage.getItem('todoAppData') }));
    expect(persisted.data).toBe(original);
    expect(persisted.mirror).toBeNull();
});

test('dashboard random material sampling preserves legacy source order', async ({ page }) => {
    const source = emptyData({
        materials: [
            { id: 'material-source-first', type: '摘抄', content: '原数组第一条', tags: [], createdAt: '2026-01-01T08:00:00', updatedAt: '2026-01-01T08:00:00' },
            { id: 'material-source-second', type: '方法', content: '原数组第二条', tags: [], createdAt: '2026-08-01T08:00:00', updatedAt: '2026-08-01T08:00:00' },
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', value);
        Math.random = () => 0;
    }, original);
    await page.goto('/#/dashboard');

    const picks = page.locator('.command-materials .command-row');
    await expect(picks).toHaveCount(2);
    await expect(picks.nth(0)).toContainText('原数组第一条');
    await expect(picks.nth(1)).toContainText('原数组第二条');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('dashboard material rows expose legacy metadata without writes', async ({ page }) => {
    const source = emptyData({
        materials: [{
            id: 'material-dashboard-meta', type: '摘抄', content: 'Dashboard 元素材', tags: ['工作', '复盘'],
            source: '测试来源', note: '测试备注', createdAt: '2026-08-01T08:09:10', updatedAt: '2026-08-01T08:09:10',
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/dashboard');

    const row = page.locator('.command-materials .command-row').filter({ hasText: 'Dashboard 元素材' });
    await expect(row).toContainText('2026年8月1日 08:09:10');
    await expect(row).toContainText('工作 · 复盘');
    await expect(row).toContainText('来源：测试来源');
    await expect(row).toContainText('备注：测试备注');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('dashboard empty habit state keeps the legacy wording', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/dashboard');
    await expect(page.locator('.dashboard-today-habits')).toContainText('今日暂无安排的习惯');
});

test('dashboard command center restores the legacy fitness card', async ({ page }) => {
    const today = (() => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData({
        bodyMetrics: [{ id: 'dashboard-metric', date: today, weight: 70, createdAt: `${today}T08:00:00`, updatedAt: `${today}T08:00:00` }],
        fitnessPlans: [{ id: 'dashboard-plan', name: '今日力量计划', status: 'active', exercises: [{ name: '深蹲', sets: [{ weight: 80, reps: 5 }] }] }],
        fitnessWorkouts: [{ id: 'dashboard-workout', date: today, status: 'done', title: '力量训练', exercises: [], createdAt: `${today}T09:00:00`, updatedAt: `${today}T09:00:00` }],
    }));

    await page.goto('/#/dashboard');
    const fitnessCard = page.locator('.command-card-fitness');
    await expect(fitnessCard).toBeVisible();
    await expect(fitnessCard).toContainText('运动健身');
    await expect(fitnessCard).toContainText('70 kg');
    await expect(fitnessCard).toContainText('今日力量计划');
    await expect(fitnessCard).toContainText('近30天训练');
    await expect(fitnessCard.getByRole('button', { name: '按计划开练' })).toBeVisible();
});

test('sidebar snapshot list keeps the legacy timestamp format', async ({ page }) => {
    const source = emptyData();
    const snapshot = {
        id: 'snapshot-time', version: 3, reason: '格式测试快照', createdAt: '2026-07-28T08:09:10',
        bytes: 128, hash: 'snapshot-hash', data: source,
    };
    await page.addInitScript(({ data, item }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSnapshots', JSON.stringify([item]));
    }, { data: source, item: snapshot });
    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: /本地快照/ }).click();
    await expect(page.getByRole('dialog', { name: '本地快照' })).toContainText('2026年7月28日 08:09:10');
});

test('sidebar snapshot preview exposes legacy collection summary', async ({ page }) => {
    const source = emptyData({
        records: [
            { id: 'record-old', title: '旧记录', type: '复盘', startDate: '2026-07-28', updatedAt: '2026-07-28T08:00:00' },
            { id: 'record-latest', title: '最近记录', type: '日记', startDate: '2026-07-30', updatedAt: '2026-07-30T08:00:00' },
        ],
        todos: [{ id: 'todo-open', done: false }, { id: 'todo-done', done: true }],
        habits: [{ id: 'habit-preview' }],
        checkins: [{ id: 'checkin-1' }, { id: 'checkin-2' }],
        goals: [{ id: 'goal-preview' }],
        materials: [{ id: 'material-preview' }],
        bodyMetrics: [{ id: 'metric-preview' }],
        fitnessPlans: [{ id: 'plan-preview' }],
        fitnessWorkouts: [{ id: 'workout-preview' }],
        exerciseLibrary: [{ id: 'exercise-preview' }],
    });
    const original = JSON.stringify(source);
    const snapshot = {
        id: 'snapshot-preview', version: 4, reason: '关系测试快照', createdAt: '2026-07-30T08:09:10',
        bytes: 256, hash: 'snapshot-preview-hash', parent: { version: 3, hash: 'parent-hash-value' },
        mergedWith: { label: '云端', version: 2, hash: 'merged-hash-value' }, source: 'cloud-pull', action: 'merge-result', data: source,
    };
    await page.addInitScript(({ data, item }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSnapshots', JSON.stringify([item]));
    }, { data: source, item: snapshot });
    await page.goto('/#/dashboard');
    const dialog = page.getByRole('dialog', { name: '本地快照' });
    await page.getByRole('button', { name: /本地快照/ }).click();
    const row = dialog.locator('.snapshot-item').first();
    await expect(row).toContainText('snapshot-preview-hash');
    await expect(row).toContainText('上一个版本：v3 · parent-h');
    await row.getByRole('button', { name: '预览' }).click();
    const preview = row.getByTestId('snapshot-preview');
    await expect(preview).toContainText('v4 · 关系测试快照');
    await expect(preview).toContainText('2026年7月30日 08:09:10');
    await expect(preview).toContainText('256 B');
    await expect(preview).toContainText('snapshot-preview-hash');
    await expect(preview).toContainText('上一个版本：v3 · parent-h');
    await expect(preview).toContainText('合并对象：云端 · v2 · merged-h');
    await expect(preview).toContainText('来源：cloud-pull/merge-result');
    await expect(preview).toContainText('记录 2');
    await expect(preview).toContainText('待办 2（未完成 1 / 已完成 1）');
    await expect(preview).toContainText('习惯 1');
    await expect(preview).toContainText('打卡 2');
    await expect(preview).toContainText('目标 1');
    await expect(preview).toContainText('素材 1');
    await expect(preview).toContainText('身材 1');
    await expect(preview).toContainText('训练计划 1');
    await expect(preview).toContainText('训练日志 1');
    await expect(preview).toContainText('动作库 1');
    await expect(preview).toContainText('2026-07-30 · 日记 · 最近记录');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('sidebar empty snapshot state explains automatic backups', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: /本地快照/ }).click();
    await expect(page.getByRole('dialog', { name: '本地快照' })).toContainText('还没有本地快照。同步、导入、删除前会自动创建，也可以手动创建一份。');
});

test('sidebar import confirmation exposes normalized legacy collection summary', async ({ page }) => {
    const local = emptyData({
        records: [{ id: 'sidebar-import-local', type: '日记', title: '本地记录', content: '', startDate: '2026-07-28', endDate: '2026-07-28' }],
    });
    const imported = emptyData({
        records: [
            { id: 'sidebar-import-shadow', type: '习惯打卡', title: '不应计入主记录', isHabitRecord: true, startDate: '2026-07-27', endDate: '2026-07-27' },
            { id: 'sidebar-import-record', type: '工作记录', title: '摘要记录', content: '', startDate: '2026-07-29', endDate: '2026-07-29' },
        ],
        todos: [todoFixture('sidebar-import-todo', '摘要待办')],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), local);
    await page.goto('/#/dashboard');

    const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.locator('input[type="file"]').setInputFiles({
            name: 'sidebar-import-summary.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(imported), 'utf8'),
        }),
    ]);
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('records:1');
    expect(dialog.message()).toContain('todos:1');
    expect(dialog.message()).toContain('habits:0');
    await dialog.accept();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records.length)).toBe(2);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records.some(record => record.id === 'sidebar-import-shadow')).toBe(false);
    expect(stored.records.some(record => record.id === 'sidebar-import-record')).toBe(true);
});

test('sidebar import honors the legacy before-snapshot confirmation branch', async ({ page }) => {
    const source = emptyData({
        records: [{ id: 'sidebar-import-failure-local', type: '日记', title: '导入前记录', content: '', startDate: '2026-07-28', endDate: '2026-07-28' }],
    });
    const imported = emptyData({
        records: [{ id: 'sidebar-import-failure-incoming', type: '工作记录', title: '继续导入记录', content: '', startDate: '2026-07-29', endDate: '2026-07-29' }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        const realSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function blockedSnapshotWrite(key, value) {
            if (key === 'lifePlanSnapshots') throw new Error('snapshot write blocked');
            return realSetItem.call(this, key, value);
        };
    }, source);
    await page.goto('/#/dashboard');

    let continueImport = false;
    const confirmations = [];
    page.on('dialog', async dialog => {
        if (dialog.type() === 'confirm') {
            confirmations.push(dialog.message());
            if (dialog.message().includes('导入前快照创建失败')) {
                if (continueImport) await dialog.accept();
                else await dialog.dismiss();
            } else {
                await dialog.accept();
            }
            return;
        }
        await dialog.accept();
    });

    const upload = () => page.locator('input[type="file"]').setInputFiles({
        name: 'sidebar-import-snapshot-failure.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(imported), 'utf8'),
    });
    await upload();
    await expect.poll(() => confirmations.filter(message => message.includes('导入前快照创建失败')).length).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);

    continueImport = true;
    await upload();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records.some(record => record.id === 'sidebar-import-failure-incoming'))).toBe(true);
});

test('records history keeps non-rule-day habit check-ins while calendar stays rule-aware', async ({ page }) => {
    const today = localDate();
    const source = emptyData({
        habits: [{ id: 'habit-history', name: '历史补记习惯', tag: '复盘', rule: 'weekly-fixed', weekdays: [], timesPerDay: 1, startDate: '2026-01-01' }],
        checkins: [{ id: 'checkin-history', habitId: 'habit-history', date: today, time: '08:00', checkinAt: `${today}T08:00:00`, note: '非规则日也保留' }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/records');

    await expect(page.locator('#all-records')).toContainText('历史补记习惯');
    await expect(page.locator('#all-records')).toContainText('非规则日也保留');

    await page.getByRole('button', { name: '日视图' }).click();
    await expect(page.locator('#all-records')).not.toContainText('历史补记习惯');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('sidebar reads the legacy wheel sync state key', async ({ page }) => {
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://dav.example.test', remotePath: '/life-plan.json' }));
        localStorage.setItem('lifePlanWheelSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'wheel-hash' }));
    }, emptyData());
    await page.goto('/#/dashboard');
    await expect(page.locator('.sync-status-inline').filter({ hasText: '转盘：' })).toHaveText('转盘：已同步');
});

test('sidebar summarizes main sync state with legacy status labels', async ({ page }) => {
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://dav.example.test', remotePath: '/life-plan.json' }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastSyncAt: '2026-07-31T12:34:56.000Z', lastRemoteHash: 'main-hash' }));
    }, emptyData());
    await page.goto('/#/dashboard');
    const status = page.locator('.sync-status-inline').filter({ hasText: '同步：' });
    await expect(status).toHaveText('同步：已同步');
    await expect(status).not.toContainText('2026-07-31');
});

test('sidebar follows live legacy main sync status events', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
        webdavUrl: 'https://dav.example.test', remotePath: '/life-plan.json', autoSync: true,
    })));
    await page.goto('/#/dashboard');
    const status = page.locator('.sync-status-inline').filter({ hasText: '同步：' });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('life-plan-main-sync-status', {
        detail: { message: '正在检查云端', isError: false },
    })));
    await expect(status).toHaveText('同步：进行中');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('life-plan-main-sync-status', {
        detail: { message: '云端和本地一致，无需同步', isError: false },
    })));
    await expect(status).toHaveText('同步：已同步');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('life-plan-main-sync-status', {
        detail: { message: '网络失败', isError: true },
    })));
    await expect(status).toHaveText('同步：失败');
});

test('dashboard quick writes plan today execute once toggle and rebuild todo mirror', async ({ page }) => {
    const today = (() => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();
    const source = emptyData({
        todos: [
            todoFixture('todo-float', '浮动待办可今天做', { urgency: 'medium' }),
            todoFixture('todo-due-today', '今日截止待办', { dueDate: today, urgency: 'high' }),
            todoFixture('todo-has-session', '已执行待办', {
                dueDate: today,
                sessions: [{ id: 's1', date: today, startTime: '09:00', endTime: '', note: '已有', createdAt: `${today}T09:00:00` }],
            }),
        ],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'dashboard-quick-before' }));
    }, source);

    await page.goto('/#/dashboard');
    const floating = page.locator('.dashboard-floating-todos .todo-item').filter({ hasText: '浮动待办可今天做' });
    await expect(floating).toHaveCount(1);
    await floating.getByRole('button', { name: '今天做', exact: true }).click();
    await expect(page.locator('.notice.success')).toContainText('已将「浮动待办可今天做」加入今日计划');
    await expect(page.locator('.dashboard-floating-todos .todo-item').filter({ hasText: '浮动待办可今天做' })).toHaveCount(0);
    await expect(page.locator('.dashboard-today-todos .todo-item').filter({ hasText: '浮动待办可今天做' })).toHaveCount(1);

    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    const planned = stored.data.todos.find(item => item.id === 'todo-float');
    expect(planned).toMatchObject({ planStartDate: today, planEndDate: today });
    expect(planned.updatedAt).not.toBe('2026-07-27T08:00:00');
    expect(stored.syncState.dirty).toBe(true);
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.mirror.todos).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'todo-float', planStartDate: today, planEndDate: today })]));

    const dueRow = page.locator('.dashboard-today-todos .todo-item').filter({ hasText: '今日截止待办' });
    await dueRow.getByRole('button', { name: '执行一次', exact: true }).click();
    await expect(page.locator('.notice.success')).toContainText('已为「今日截止待办」记录一次执行');
    stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    const executed = stored.data.todos.find(item => item.id === 'todo-due-today');
    expect(executed.sessions).toHaveLength(1);
    expect(executed.sessions[0]).toMatchObject({ date: today, note: '快捷执行', endTime: '' });
    expect(executed.sessions[0].startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(stored.syncState.dirty).toBe(true);
    expect(stored.mirror.todos).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'todo-due-today', sessions: expect.arrayContaining([expect.objectContaining({ note: '快捷执行' })]) }),
    ]));

    await dueRow.getByRole('button', { name: '执行一次', exact: true }).click();
    await expect(page.locator('.notice.warning')).toContainText('已经记录过一次执行');

    await dueRow.getByRole('checkbox', { name: '完成 今日截止待办' }).click();
    await expect(page.locator('.notice.success')).toContainText('已标记完成「今日截止待办」');
    await expect(page.locator('.dashboard-today-todos .todo-item').filter({ hasText: '今日截止待办' })).toHaveCount(0);
    stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    const doneTodo = stored.data.todos.find(item => item.id === 'todo-due-today');
    expect(doneTodo.done).toBe(true);
    expect(doneTodo.completedAt).toBeTruthy();
    expect(stored.data.deletedItems).toEqual([]);
    expect(stored.mirror.todos).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'todo-due-today', done: true })]));
});

test('dashboard floating todo age modes prefer legacy creation timestamps', async ({ page }) => {
    const source = emptyData({
        todos: [
            todoFixture('todo-created-old', '创建时间较早', { createdAt: '2026-01-01T08:00:00', updatedAt: '2026-08-01T08:00:00' }),
            todoFixture('todo-created-new', '创建时间较晚', { createdAt: '2026-07-01T08:00:00', updatedAt: '2026-01-01T08:00:00' }),
        ],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/dashboard');

    const floating = page.locator('.dashboard-floating-todos');
    await floating.getByRole('button', { name: '最新', exact: true }).click();
    await expect(floating.locator('.todo-item').first()).toContainText('创建时间较晚');
    await floating.getByRole('button', { name: '最老', exact: true }).click();
    await expect(floating.locator('.todo-item').first()).toContainText('创建时间较早');
});

test('dashboard habit quick check-in writes checkin and rebuilds habit mirror', async ({ page }) => {
    const today = (() => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();
    const source = emptyData({
        habits: [{
            id: 'habit-dash-checkin',
            name: '首页打卡习惯',
            tag: '健康',
            rule: 'daily',
            timesPerDay: '1',
            startDate: today,
            rewardPoints: 3,
            rewardCurrency: '金币',
            createdAt: `${today}T08:00:00`,
            updatedAt: `${today}T08:00:00`,
        }],
        checkins: [],
        habitPointLedger: [],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'dashboard-habit-before' }));
    }, source);

    await page.goto('/#/dashboard');
    const habitCard = page.locator('.dashboard-today-habits');
    const row = habitCard.locator('.todo-item').filter({ hasText: '首页打卡习惯' });
    await expect(row).toHaveCount(1);
    await expect(page.locator('.summary-card').filter({ hasText: '习惯完成' })).toContainText('0/1');
    await row.getByRole('button', { name: '打卡', exact: true }).click();
    await expect(page.locator('.notice.success')).toContainText('已为「首页打卡习惯」打卡');
    await expect(page.locator('.summary-card').filter({ hasText: '习惯完成' })).toContainText('1/1');
    await expect(row.getByRole('button', { name: '备注', exact: true })).toBeVisible();

    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.checkins).toEqual(expect.arrayContaining([
        expect.objectContaining({ habitId: 'habit-dash-checkin', date: today }),
    ]));
    expect(stored.data.habitPointLedger).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'checkin', amount: 3, habitId: 'habit-dash-checkin', currency: '金币' }),
    ]));
    expect(stored.data.deletedItems).toEqual([]);
    expect(stored.syncState.dirty).toBe(true);
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mirror.mirror.reason).toBe('append-checkin');

    await row.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(page.locator('.notice.success')).toContainText('已撤销');
    stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
    }));
    expect(stored.data.checkins.filter(item => item.habitId === 'habit-dash-checkin')).toHaveLength(0);
    expect(stored.data.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'checkins', reason: 'manual-decrease', habitId: 'habit-dash-checkin' }),
    ]));
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
});

test('dashboard today habit metadata mirrors legacy action card', async ({ page }) => {
    const today = localDate();
    const source = emptyData({
        habits: [{
            id: 'habit-dashboard-metadata', name: '晨间阅读', tag: '成长', rule: 'daily', timesPerDay: 2,
            rewardPoints: 5, rewardCurrency: '金币', penaltyPoints: 2, startDate: today,
        }],
        checkins: [{
            id: 'checkin-dashboard-metadata', habitId: 'habit-dashboard-metadata', date: today,
            time: '08:15', checkinAt: `${today}T08:15:00`, createdAt: `${today}T08:15:00`, note: '读完一章',
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/dashboard');
    const row = page.locator('.dashboard-today-habits .todo-item').filter({ hasText: '晨间阅读' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('每天');
    await expect(row).toContainText('进行中 1/2');
    await expect(row).toContainText('08:15');
    await expect(row).toContainText('+5 金币');
    await expect(row).toContainText('漏打 -2');
    await expect(row).toContainText('备注：读完一章');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('dashboard today habit metadata chooses the legacy latest timed checkin', async ({ page }) => {
    const today = localDate();
    const source = emptyData({
        habits: [{ id: 'habit-dashboard-time-order', name: '按时间排序习惯', rule: 'daily', timesPerDay: 2, startDate: today }],
        checkins: [
            { id: 'checkin-dashboard-evening', habitId: 'habit-dashboard-time-order', date: today, time: '19:30', note: '晚间记录' },
            { id: 'checkin-dashboard-morning', habitId: 'habit-dashboard-time-order', date: today, time: '08:00', note: '晨间记录' },
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);

    await page.goto('/#/dashboard');
    const row = page.locator('.dashboard-today-habits .todo-item').filter({ hasText: '按时间排序习惯' });
    await expect(row).toContainText('19:30');
    await expect(row).toContainText('备注：晚间记录');
    await expect(row).not.toContainText('晨间记录');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('dashboard fixed habit reward ignores stale random bounds', async ({ page }) => {
    const today = localDate();
    const source = emptyData({
        habits: [{
            id: 'habit-dashboard-fixed-zero', name: '无固定奖励习惯', rule: 'daily', timesPerDay: 1,
            rewardPoints: 0, rewardCurrency: '测试代币', randomReward: false, rewardMin: 3, rewardMax: 7, startDate: today,
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);

    await page.goto('/#/dashboard');
    const row = page.locator('.dashboard-today-habits .todo-item').filter({ hasText: '无固定奖励习惯' });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.habit-quick-meta')).not.toContainText('测试代币');
    await expect(row).not.toContainText('+0');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('dashboard habit actions expose legacy note and decrease branches', async ({ page }) => {
    const today = localDate();
    const source = emptyData({
        habits: [
            { id: 'habit-dashboard-single-note', name: '单次备注习惯', rule: 'daily', timesPerDay: 1, startDate: today },
            { id: 'habit-dashboard-multi-note', name: '多次备注习惯', rule: 'daily', timesPerDay: 2, startDate: today },
        ],
        checkins: [{ id: 'checkin-dashboard-single-note', habitId: 'habit-dashboard-single-note', date: today, time: '08:00', note: '旧备注', checkinAt: `${today}T08:00:00` }],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
    }, source);
    await page.goto('/#/dashboard');
    const single = page.locator('.dashboard-today-habits .todo-item').filter({ hasText: '单次备注习惯' });
    const multi = page.locator('.dashboard-today-habits .todo-item').filter({ hasText: '多次备注习惯' });
    await expect(single.getByRole('button', { name: '备注', exact: true })).toBeVisible();
    await expect(single.getByRole('button', { name: '撤销', exact: true })).toBeVisible();
    await expect(multi.getByRole('button', { name: '打卡', exact: true })).toBeVisible();
    await expect(multi.getByRole('button', { name: '备注', exact: true })).toBeVisible();
    await expect(multi.getByRole('button', { name: '-1', exact: true })).toHaveCount(0);

    page.once('dialog', dialog => {
        expect(dialog.type()).toBe('prompt');
        expect(dialog.defaultValue()).toBe('');
        dialog.accept('第一次备注');
    });
    await multi.getByRole('button', { name: '备注', exact: true }).click();
    await expect(multi).toContainText('备注：第一次备注');
    await expect(multi.getByRole('button', { name: '-1', exact: true })).toBeVisible();

    await multi.getByRole('button', { name: '-1', exact: true }).click();
    await expect(multi).toContainText('0/2');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.checkins.filter(item => item.habitId === 'habit-dashboard-multi-note')).toHaveLength(0);
});

test('dashboard weekly fixed habit metadata keeps legacy rule wording', async ({ page }) => {
    const today = localDate();
    const weekday = String(new Date(`${today}T12:00:00`).getDay());
    const source = emptyData({
        habits: [{
            id: 'habit-dashboard-weekly-fixed', name: '固定日阅读', tag: '成长', rule: 'weekly-fixed', weekdays: [weekday],
            timesPerDay: 1, startDate: today,
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/dashboard');
    const row = page.locator('.dashboard-today-habits .todo-item').filter({ hasText: '固定日阅读' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('固定周几');
    await expect(row).not.toContainText('每周固定');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
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
    await expect(page.getByRole('button', { name: /更新后的目标/ })).toContainText('(已完成)');

    let persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    let existing = persisted.goals.find(goal => goal.id === 'goal-existing');
    expect(existing).toMatchObject({ id: 'goal-existing', name: '更新后的目标', period: '长期', target: '新的目标描述', status: '已完成', progress: 70, createDate: '2026-01-01' });
    expect(existing.updatedAt).toBeUndefined();
    expect(existing.createdAt).toBeUndefined();

    await page.getByRole('button', { name: '+ 新建目标' }).click();
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

test('goals editor closes with Escape without persisting draft', async ({ page }) => {
    const source = emptyData({
        goals: [{ id: 'goal-escape', name: '保留目标', period: '年度', target: '保留描述', status: '进行中', progress: 45, createDate: '2026-01-01' }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);

    await page.goto('/#/goals?goal=goal-escape');
    const dialog = page.getByRole('dialog', { name: '编辑目标' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('目标', { exact: true }).fill('未保存草稿');
    await dialog.getByLabel('目标描述').fill('不应持久化');
    await dialog.getByRole('slider').fill('90');

    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/#\/goals$/);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('goals keep legacy insertion order in the browse list', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData({
        goals: [
            { id: 'goal-first', name: '先建目标', period: '长期', target: '先出现', status: '进行中', progress: 10, createDate: '2026-01-01' },
            { id: 'goal-second', name: '后建目标', period: '年度', target: '后出现', status: '进行中', progress: 90, createDate: '2026-01-02' },
        ],
    }));

    await page.goto('/#/goals');
    const cards = page.locator('.goal-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('先建目标');
    await expect(cards.nth(1)).toContainText('后建目标');
});

test('goals cards expose legacy level-four heading semantics without persisting', async ({ page }) => {
    const source = emptyData({
        goals: [{ id: 'goal-heading', name: '语义层级目标', period: '年度', target: '保持只读', status: '进行中', progress: 25, createDate: '2026-01-01' }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);

    await page.goto('/#/goals');

    await expect(page.getByRole('heading', { level: 4, name: /语义层级目标/ })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('goals preserve existing out-of-range progress in read-only browse summaries', async ({ page }) => {
    const source = emptyData({
        goals: [
            { id: 'goal-over', name: '超额目标', period: '年度', target: '超过一百', status: '进行中', progress: 120, createDate: '2026-01-01' },
            { id: 'goal-under', name: '负值目标', period: '长期', target: '旧数据', status: '暂停', progress: -5, createDate: '2026-01-02' },
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/goals');

    await expect(page.getByRole('button', { name: /超额目标/ })).toContainText('120%');
    await expect(page.getByRole('button', { name: /负值目标/ })).toContainText('-5%');
    await expect(page.locator('.summary-card').filter({ hasText: '平均进度' })).toContainText('58%');

    await page.getByRole('button', { name: /超额目标/ }).click();
    await page.getByRole('dialog', { name: '编辑目标' }).getByRole('button', { name: '取消' }).click();
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('goals loading keeps legacy type-aware progress normalization and writeback', async ({ page }) => {
    const source = emptyData({
        goals: [
            { id: 'goal-string-progress', name: '字符串进度目标', period: '年度', target: '旧数据', status: '进行中', progress: '50', createDate: '2026-01-01' },
            { id: 'goal-empty-progress', name: '空进度完成目标', period: '长期', target: '旧数据', status: '已完成', progress: '', createDate: '2026-01-02' },
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/goals');

    await expect(page.getByRole('button', { name: /字符串进度目标/ })).toContainText('0%');
    await expect(page.getByRole('button', { name: /空进度完成目标/ })).toContainText('100%');
    await expect(page.locator('.summary-card').filter({ hasText: '平均进度' })).toContainText('50%');

    const persisted = await page.evaluate(() => ({
        raw: localStorage.getItem('lifePlanData'),
        goals: JSON.parse(localStorage.getItem('lifePlanData')).goals,
    }));
    expect(persisted.raw).not.toBe(original);
    expect(persisted.goals).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'goal-string-progress', progress: 0 }),
        expect.objectContaining({ id: 'goal-empty-progress', progress: 100 }),
    ]));
});

test('goals empty state keeps the legacy copy', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/goals');
    await expect(page.locator('#page-goals .empty-state')).toHaveText('暂无目标，点击右上角新建');
});

test('goals card preserves legacy empty field rendering', async ({ page }) => {
    const source = emptyData({
        goals: [{ id: 'goal-empty-fields', name: '字段为空目标', period: '', target: '', status: '', progress: 0, createDate: '2026-07-30' }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/goals');

    const card = page.locator('.goal-card').filter({ hasText: '字段为空目标' });
    await expect(card).toContainText('字段为空目标');
    const cardText = await card.textContent();
    expect(cardText).not.toContain('未命名目标');
    expect(cardText).not.toContain('进行中');
    expect(cardText).not.toContain('未设置周期');
    expect(cardText).not.toContain('未填写目标描述');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
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
    await expect(page.locator('.search-result-item').filter({ hasText: '共享标签素材内容' })).toContainText('2026年7月28日 08:00:00');

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
    await expect(page.locator('#wheel-management-block')).toBeVisible();
    await expect(page.locator('#wheel-management-block')).toHaveAttribute('data-management-panel', 'library');
    await expect(page.locator('[data-wheel-library-id="wheel-library-search"]')).toContainText('搜索转盘公共项');
    await expect(page.getByPlaceholder('公共项名称')).toHaveValue('');

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
    await expect(page.locator('#wheel-management-block')).toBeVisible();
    await expect(page.locator('#wheel-management-block')).toHaveAttribute('data-management-panel', 'tags');
    await expect(page.locator('[data-wheel-tag-id="wheel-tag-search"]')).toContainText('共享标签');
    await expect(page.getByPlaceholder('标签名称')).toHaveValue('');

    const persisted = await page.evaluate(() => ({ data: localStorage.getItem('lifePlanData'), mirror: localStorage.getItem('todoAppData') }));
    expect(persisted.data).toBe(original);
    expect(persisted.mirror).toBeNull();
});

test('tag center opens wheel tag management when no wheel tag exists', async ({ page }) => {
    const source = emptyData({
        records: [{
            id: 'idea-tag-only', type: '灵感碎片', title: '只有灵感来源的标签', content: '',
            startDate: '2026-07-28', endDate: '2026-07-28', ideaStatus: '待整理', ideaTags: ['孤立标签'], todoIds: [],
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/tags');
    const card = page.locator('.tag-center-card').filter({ hasText: '孤立标签' });
    await expect(card).toContainText('只有灵感来源的标签');
    await card.getByRole('button').filter({ hasText: '转盘项' }).click();

    await expectHashRoute(page, '/wheel', { tag: '' });
    const management = page.locator('#wheel-management-block');
    await expect(management).toBeVisible();
    await expect(management).toHaveAttribute('data-management-panel', 'tags');
    await expect(page.getByPlaceholder('标签名称')).toHaveValue('');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('search record results open a read-only preview before editing', async ({ page }) => {
    const source = emptyData({
        records: [{ id: 'search-preview-record', type: '日记', title: '搜索预览记录', content: '搜索结果正文', startDate: '2026-07-28', endDate: '2026-07-28', todoIds: [] }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/search?q=搜索预览');
    await page.locator('.search-result-item').filter({ hasText: '搜索预览记录' }).click();
    await expectHashRoute(page, '/records', { record: 'search-preview-record', preview: '1' });
    const preview = page.getByRole('dialog', { name: '记录预览' });
    await expect(preview).toContainText('搜索结果正文');
    await expect(page.locator('.record-editor-panel')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);

    await preview.getByRole('button', { name: '编辑', exact: true }).click();
    await expect(page.locator('.record-editor-panel')).toBeVisible();
    await expectHashRoute(page, '/records', { record: 'search-preview-record' });
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('search todo fields mirror the legacy index contract', async ({ page }) => {
    const source = emptyData({
        todos: [
            todoFixture('todo-search-note-only', '普通待办', { note: '备注专属词' }),
            todoFixture('todo-search-plan-summary', '计划摘要待办', { planStartDate: '2026-07-30', planEndDate: '2026-08-02' }),
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);

    await page.goto('/#/search?q=备注专属词&scope=todos');
    await expect(page.locator('.search-result-item')).toHaveCount(0);
    await expect(page.locator('.empty-state')).toContainText('没有找到匹配内容');

    await page.goto('/#/search?q=2026-08-02&scope=todos');
    await expect(page.locator('.search-result-item')).toHaveCount(0);

    await page.goto('/#/search?q=8月2日&scope=todos');
    await expect(page.locator('.search-result-item')).toHaveCount(1);
    await expect(page.locator('.search-result-item')).toContainText('计划摘要待办');
    await expect(page.locator('.search-result-item')).toContainText('无截止');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('wheel canvas click drag and tag stage preserve interaction contracts', async ({ page }) => {
    const source = emptyData({
        wheels: [
            {
                id: 'wheel-normal',
                name: '专注普通盘',
                mode: 'normal',
                items: [
                    { id: 'normal-read', name: '深度阅读', note: '读 25 分钟', weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
                    { id: 'normal-walk', name: '散步复盘', note: '', weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
                ],
                createdAt: '2026-07-28T08:00:00',
                updatedAt: '2026-07-28T08:00:00',
            },
            {
                id: 'wheel-tag',
                name: '两段标签盘',
                mode: 'tag',
                tagIds: ['tag-dinner', 'tag-move'],
                items: [],
                createdAt: '2026-07-28T08:00:00',
                updatedAt: '2026-07-28T08:00:00',
            },
        ],
        wheelTags: [
            { id: 'tag-dinner', name: '晚餐', color: '#ff6b6b', weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
            { id: 'tag-move', name: '活动', color: '#216e4e', weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
        ],
        wheelLibraryItems: [
            { id: 'library-noodle', name: '番茄牛肉面', note: '家里做', tagIds: ['tag-dinner'], weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
            { id: 'library-stretch', name: '拉伸十分钟', note: '', tagIds: ['tag-move'], weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
        ],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'wheel-before' }));
        Math.random = () => 0;
        window.__wheelSpinDurationMs = 1;
    }, source);

    await page.goto('/#/wheel');
    await expect(page.locator('.wheel-mode-badge')).toContainText('普通转盘 · 一步出结果');
    const canvasWrap = page.locator('.wheel-canvas-wrap');
    await expect(canvasWrap).toBeVisible();
    await expect.poll(() => page.locator('.wheel-canvas').evaluate(canvas => {
        const context = canvas.getContext('2d');
        if (!context) return 0;
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) painted += 1;
        return painted;
    })).toBeGreaterThan(1000);

    await canvasWrap.click();
    await expect(page.locator('.wheel-result')).toContainText('深度阅读');
    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.wheelHistory).toHaveLength(1);
    expect(stored.data.wheelHistory[0]).toMatchObject({ wheelId: 'wheel-normal', resultId: 'normal-read', resultName: '深度阅读' });
    expect(stored.syncState.dirty).toBe(true);

    await page.locator('.wheel-result').getByRole('button', { name: '只保留记录' }).click();
    await expect(page.locator('.wheel-result')).not.toContainText('深度阅读');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).wheelHistory.length)).toBe(1);

    const box = await canvasWrap.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 24, box.y + box.height / 2 + 32, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).wheelHistory.length)).toBe(2);

    await page.getByLabel('当前转盘', { exact: true }).selectOption('wheel-tag');
    await expect(page.locator('.wheel-mode-badge')).toContainText('标签转盘 · 两段抽取');
    await expect(page.locator('.wheel-result')).toContainText('2 个候选');
    await canvasWrap.click();
    await expect(page.locator('.wheel-result')).toContainText('已锁定：晚餐');
    await canvasWrap.click();
    await expect(page.locator('.wheel-result')).toContainText('番茄牛肉面');
    await page.locator('.wheel-result').getByRole('button', { name: '转入待办' }).click();
    await expect(page.locator('.wheel-result').getByRole('button', { name: '已转入待办' })).toBeDisabled();

    stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        todoMirror: JSON.parse(localStorage.getItem('todoAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.wheelHistory).toHaveLength(3);
    expect(stored.data.wheelHistory[0]).toMatchObject({ wheelId: 'wheel-tag', mode: 'tag', tagName: '晚餐', resultName: '番茄牛肉面', convertedTodoId: expect.any(String) });
    const linkedTodo = stored.data.todos.find(todo => todo.id === stored.data.wheelHistory[0].convertedTodoId);
    expect(linkedTodo).toMatchObject({ text: '番茄牛肉面', sourceType: 'wheel', sourceRecordId: stored.data.wheelHistory[0].id, group: '转盘' });
    expect(stored.todoMirror.authority).toBe('lifePlanData.todos');
    expect(stored.todoMirror.todos).toEqual(expect.arrayContaining([expect.objectContaining({ id: linkedTodo.id, text: '番茄牛肉面' })]));
    expect(stored.syncState.dirty).toBe(true);
});

test('wheel canvas keeps legacy click-only extraction', async ({ page }) => {
    const source = emptyData({
        wheels: [{
            id: 'wheel-click-only', name: '点击抽取盘', mode: 'normal',
            items: [{ id: 'click-only-item', name: '点击项目', note: '', weight: 1, enabled: true }],
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        window.__wheelSpinDurationMs = 1;
    }, source);
    await page.goto('/#/wheel');

    const canvasWrap = page.locator('.wheel-canvas-wrap');
    await expect(canvasWrap).not.toHaveAttribute('role', 'button');
    await expect(canvasWrap).not.toHaveAttribute('tabindex');
    await canvasWrap.dispatchEvent('keydown', { key: 'Enter' });
    await canvasWrap.dispatchEvent('keydown', { key: ' ' });
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('wheel refuses deleting the last wheel like legacy', async ({ page }) => {
    const source = emptyData({
        wheels: [{
            id: 'wheel-last-only', name: '最后一个转盘', mode: 'normal',
            items: [{ id: 'wheel-last-item', name: '保留选项', note: '', weight: 1, enabled: true }],
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').last().click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();
    const row = page.locator('.wheel-list-card').filter({ hasText: '最后一个转盘' });
    page.once('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.locator('.wheel-notice')).toContainText('至少保留一个转盘');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('wheel public library batch actions preserve selection and tombstone contracts', async ({ page }) => {
    const source = emptyData({
        wheelTags: [
            { id: 'tag-dinner', name: '晚餐', color: '#ff6b6b', weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
            { id: 'tag-move', name: '活动', color: '#216e4e', weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
            { id: 'tag-rest', name: '休息', color: '#4f7cac', weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
        ],
        wheelLibraryItems: [
            { id: 'lib-noodle', name: '番茄牛肉面', note: '', tagIds: ['tag-dinner'], weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
            { id: 'lib-stretch', name: '拉伸十分钟', note: '', tagIds: ['tag-move'], weight: 1, enabled: false, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
            { id: 'lib-tea', name: '泡茶放空', note: '', tagIds: ['tag-rest', 'tag-dinner'], weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' },
        ],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'wheel-library-before' }));
    }, source);

    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '公共项库' }).click();
    const library = page.locator('.library-card');
    await expect(library).toContainText('公共项库');
    await expect(page.locator('.library-row')).toHaveCount(3);
    await page.locator('select[aria-label="公共项标签筛选"]').selectOption('tag-dinner');
    await expect(page.locator('.library-row')).toHaveCount(2);

    await page.locator('.library-batch-bar input[type="checkbox"]').first().check();
    await expect(page.locator('.library-batch-bar')).toContainText('选中 2');
    await page.getByRole('checkbox', { name: '选择公共项 番茄牛肉面' }).check();
    await page.getByRole('checkbox', { name: '选择公共项 泡茶放空' }).check();

    await library.locator('.batch-tag-checks').getByRole('checkbox', { name: '活动' }).check();
    await page.getByRole('button', { name: '批量加标签' }).click();
    await expect(page.locator('.wheel-notice')).toContainText('已给 2 个公共项加上标签：活动');
    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
        deletedItems: JSON.parse(localStorage.getItem('lifePlanData')).deletedItems,
    }));
    expect(stored.syncState.dirty).toBe(true);
    expect(stored.data.wheelLibraryItems.find(item => item.id === 'lib-noodle')).toMatchObject({ tagIds: ['tag-dinner', 'tag-move'] });
    expect(stored.data.wheelLibraryItems.find(item => item.id === 'lib-tea')).toMatchObject({ tagIds: ['tag-rest', 'tag-dinner', 'tag-move'] });

    await page.getByRole('button', { name: '批量去标签' }).click();
    await expect(page.locator('.wheel-notice')).toContainText('已从 2 个公共项去掉标签：活动');
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelLibraryItems.find(item => item.id === 'lib-noodle')).toMatchObject({ tagIds: ['tag-dinner'] });
    expect(stored.wheelLibraryItems.find(item => item.id === 'lib-tea')).toMatchObject({ tagIds: ['tag-rest', 'tag-dinner'] });

    await page.getByRole('button', { name: '批量停用' }).click();
    await expect(page.locator('.wheel-notice')).toContainText('已批量停用 2 个公共项');
    await page.getByRole('button', { name: '批量启用' }).click();
    await expect(page.locator('.wheel-notice')).toContainText('已批量启用 2 个公共项');

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '批量删除' }).click();
    await expect(page.locator('.wheel-notice')).toContainText('已删除 2 个公共项');
    stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.wheelLibraryItems).toHaveLength(1);
    expect(stored.data.deletedItems.filter(item => item.collection === 'wheelLibraryItems').map(item => item.id)).toEqual(expect.arrayContaining(['lib-noodle', 'lib-tea']));
    expect(stored.syncState.dirty).toBe(true);

    await page.locator('select[aria-label="公共项标签筛选"]').selectOption('tag-move');
    await page.getByRole('checkbox', { name: '选择公共项 拉伸十分钟' }).check();
    await page.getByRole('button', { name: '批量去标签' }).click();
    await expect(page.locator('.wheel-notice')).toContainText('没有可移除的标签；公共项至少要保留一个标签');
});

test('wheel management forms focus editable rows without mutating data', async ({ page }) => {
    const source = emptyData({
        wheels: [{
            id: 'wheel-management-polish',
            name: '管理表单验证转盘',
            mode: 'normal',
            items: [{ id: 'option-management-polish', name: '需要编辑的长选项名称', note: '', weight: 2, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
            createdAt: '2026-07-29T08:00:00',
            updatedAt: '2026-07-29T08:00:00',
        }],
        wheelTags: [
            { id: 'tag-management-polish', name: '管理标签', color: '#216e4e', weight: 3, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
        ],
        wheelLibraryItems: [
            { id: 'library-management-polish', name: '管理公共项长名称', note: '', tagIds: ['tag-management-polish'], weight: 4, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
        ],
        wheelHistory: [
            { id: 'history-management-polish', wheelId: 'wheel-management-polish', wheelName: '管理表单验证转盘', mode: 'normal', resultId: 'option-management-polish', resultName: '需要编辑的长选项名称', note: '', convertedTodoId: '', createdAt: '2026-07-29T09:00:00', updatedAt: '2026-07-29T09:00:00' },
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);

    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();
    const summary = page.locator('.wheel-management-summary');
    await expect(summary).toContainText('1当前选项');
    await expect(summary).toContainText('1标签');
    await expect(summary).toContainText('1公共项');
    await expect(summary).toContainText('1记录');
    await expect(page.locator('#wheel-create-panel')).toBeHidden();
    await expect(page.locator('#wheel-history-panel')).toBeHidden();

    await page.locator('.wheel-stage-card').getByRole('button', { name: '编辑当前' }).click();
    await page.locator('.management-card').filter({ hasText: '普通转盘选项' }).locator('.entity-row').filter({ hasText: '需要编辑的长选项名称' }).getByRole('button', { name: '编辑' }).click();
    await expect(page.getByLabel('选项名称')).toHaveValue('需要编辑的长选项名称');

    await page.locator('.wheel-management-nav').getByRole('button', { name: '标签管理' }).click();
    await page.locator('.management-card').filter({ hasText: '标签管理' }).locator('.entity-row').filter({ hasText: '管理标签' }).getByRole('button', { name: '编辑' }).click();
    await expect(page.getByLabel('标签名称')).toHaveValue('管理标签');

    await page.locator('.wheel-management-nav').getByRole('button', { name: '公共项库' }).click();
    await page.locator('.library-row').filter({ hasText: '管理公共项长名称' }).getByRole('button', { name: '编辑' }).click();
    await expect(page.getByLabel('公共项名称')).toHaveValue('管理公共项长名称');

    const persisted = await page.evaluate(() => ({
        data: localStorage.getItem('lifePlanData'),
        mirror: localStorage.getItem('todoAppData'),
    }));
    expect(persisted.data).toBe(original);
    expect(persisted.mirror).toBeNull();
});

test('wheel normal option batch import skips duplicate names and preserves weights', async ({ page }) => {
    const source = emptyData({
        wheels: [{ id: 'wheel-batch', name: '批量导入盘', mode: 'normal', items: [{ id: 'option-existing', name: '已有选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }], createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();
    await page.locator('.wheel-stage-card').getByRole('button', { name: '编辑当前' }).click();
    const tools = page.locator('.wheel-batch-tools').filter({ hasText: '批量导入选项' });
    await tools.locator('summary').click();
    await tools.locator('textarea').fill('晨跑,2\n已有选项\n拉伸');
    await tools.getByRole('button', { name: '导入到当前转盘' }).click();
    await expect(page.locator('.wheel-notice')).toContainText('已添加 2 个选项，跳过 1 个');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheels[0].items).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: '晨跑', weight: 2 }),
        expect.objectContaining({ name: '拉伸', weight: 1 }),
    ]));
    expect(stored.wheels[0].items.filter(item => item.name === '已有选项')).toHaveLength(1);
});

test('wheel normal option copy imports a public item with source metadata', async ({ page }) => {
    const source = emptyData({
        wheels: [{ id: 'wheel-copy', name: '公共项复制盘', mode: 'normal', items: [], createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
        wheelTags: [{ id: 'tag-copy', name: '学习', color: '#216e4e', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
        wheelLibraryItems: [{ id: 'library-copy', name: '公共阅读', note: '来自公共项库', tagIds: ['tag-copy'], weight: 3, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();
    await page.locator('.wheel-stage-card').getByRole('button', { name: '编辑当前' }).click();
    const tools = page.locator('.wheel-copy-tools');
    await tools.locator('summary').click();
    await tools.getByLabel('复制公共项', { exact: true }).selectOption('library-copy');
    await tools.getByRole('button', { name: '复制到当前转盘' }).click();
    await expect(page.locator('.wheel-notice')).toContainText('已复制公共项：公共阅读');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheels[0].items).toEqual([expect.objectContaining({ name: '公共阅读', note: '来自公共项库', weight: 3, sourceLibraryItemId: 'library-copy', enabled: true })]);
});

test('wheel tag management previews, directly spins, and toggles tag state', async ({ page }) => {
    const source = emptyData({
        wheels: [
            { id: 'wheel-normal-tag-actions', name: '普通盘', mode: 'normal', items: [{ id: 'normal-action', name: '普通项', note: '', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }], createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
            { id: 'wheel-tag-actions', name: '标签盘', mode: 'tag', tagIds: ['tag-actions'], items: [], createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
        ],
        wheelTags: [{ id: 'tag-actions', name: '学习', color: '#216e4e', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
        wheelLibraryItems: [{ id: 'library-action', name: '公共阅读', note: '', tagIds: ['tag-actions'], weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        Math.random = () => 0;
        window.__wheelSpinDurationMs = 1;
    }, source);
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '标签管理' }).click();
    const tagRow = page.locator('#wheel-tags-panel .entity-row').filter({ hasText: '学习' });
    await tagRow.getByRole('button', { name: '先看这个标签池' }).click();
    await expect(page.locator('.wheel-stage-title')).toContainText('已锁定：学习');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).wheelHistory.length)).toBe(0);

    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '标签管理' }).click();
    await page.locator('#wheel-tags-panel .entity-row').filter({ hasText: '学习' }).getByRole('button', { name: '只转这个标签' }).click();
    await expect(page.locator('.wheel-result')).toContainText('公共阅读');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '标签管理' }).click();
    await page.locator('#wheel-tags-panel .entity-row').filter({ hasText: '学习' }).getByRole('button', { name: '停用' }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelTags.find(tag => tag.id === 'tag-actions').enabled).toBe(false);
});

test('wheel library batch import uses selected tags and row toggle persists', async ({ page }) => {
    const source = emptyData({
        wheelTags: [{ id: 'tag-library-batch', name: '工作', color: '#216e4e', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
        wheelLibraryItems: [{ id: 'library-existing-batch', name: '已有公共项', note: '', tagIds: ['tag-library-batch'], weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '公共项库' }).click();
    const batch = page.locator('.library-batch-tools');
    await batch.locator('summary').click();
    await batch.getByRole('checkbox', { name: '工作' }).check();
    await batch.locator('textarea').fill('新公共项,2\n已有公共项');
    await batch.getByRole('button', { name: '导入公共项' }).click();
    await expect(page.locator('.wheel-notice')).toContainText('已添加 1 个公共项，跳过 1 个');
    const existingRow = page.locator('.library-row').filter({ hasText: '已有公共项' });
    await existingRow.getByRole('button', { name: '停用' }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelLibraryItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: '新公共项', weight: 2, tagIds: ['tag-library-batch'], enabled: true }),
        expect.objectContaining({ name: '已有公共项', enabled: false }),
    ]));
});

test('wheel library AI suggestions stay within existing tags before save', async ({ page }) => {
    const source = emptyData({
        wheelTags: [
            { id: 'tag-ai-study', name: '学习', color: '#216e4e', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
            { id: 'tag-ai-health', name: '健康', color: '#4f7cac', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
        ],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '公共项库' }).click();
    const panel = page.locator('#wheel-library-panel');
    await panel.getByLabel('公共项名称').fill('学习');
    await panel.getByRole('button', { name: 'AI 推荐标签' }).click();
    await expect(panel.locator('.library-ai-suggestion')).toContainText('学习');
    await panel.locator('.tag-checks').getByRole('checkbox', { name: '健康' }).check();
    const manualStudyTag = panel.locator('.tag-checks').getByRole('checkbox', { name: '学习' });
    await manualStudyTag.uncheck();
    await expect(panel.locator('.library-ai-suggestion').getByRole('checkbox', { name: '学习' })).not.toBeChecked();
    await panel.getByRole('button', { name: '添加公共项' }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelLibraryItems).toEqual(expect.arrayContaining([expect.objectContaining({ name: '学习', tagIds: ['tag-ai-health'] })]));
});

test('wheel management landing keeps workspace navigation focused', async ({ page }) => {
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();

    const landing = page.locator('.wheel-management-landing');
    await expect(landing).toBeVisible();
    await expect(landing.locator('.wheel-management-summary')).toContainText('当前选项');
    await expect(landing.getByRole('button', { name: '公共项库' })).toBeVisible();
    await landing.getByRole('button', { name: '公共项库' }).click();
    await expect(page.locator('#wheel-library-panel')).toBeInViewport();
});

test('wheel management summary reflects active wheel counts', async ({ page }) => {
    const source = emptyData({
        wheels: [
            { id: 'wheel-summary-tag', name: '摘要标签盘', mode: 'tag', tagIds: ['tag-summary-on', 'tag-summary-off'], items: [], createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
            { id: 'wheel-summary-other', name: '其他转盘', mode: 'normal', items: [{ id: 'summary-other-item', name: '其他项', weight: 1, enabled: true }], createdAt: '2026-07-29T09:00:00', updatedAt: '2026-07-29T09:00:00' },
        ],
        wheelTags: [
            { id: 'tag-summary-on', name: '启用标签', color: '#216e4e', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
            { id: 'tag-summary-off', name: '停用标签', color: '#4f7cac', weight: 1, enabled: false, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
        ],
        wheelLibraryItems: [
            { id: 'library-summary-on', name: '启用公共项', tagIds: ['tag-summary-on'], weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
            { id: 'library-summary-off', name: '停用公共项', tagIds: ['tag-summary-on'], weight: 1, enabled: false, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
        ],
        wheelHistory: [
            { id: 'summary-history-1', wheelId: 'wheel-summary-tag', wheelName: '摘要标签盘', mode: 'tag', resultId: 'library-summary-on', resultName: '启用公共项', createdAt: '2026-07-29T10:00:00', updatedAt: '2026-07-29T10:00:00' },
            { id: 'summary-history-2', wheelId: 'wheel-summary-tag', wheelName: '摘要标签盘', mode: 'tag', resultId: 'library-summary-on', resultName: '启用公共项', createdAt: '2026-07-29T11:00:00', updatedAt: '2026-07-29T11:00:00' },
            { id: 'summary-history-other', wheelId: 'wheel-summary-other', wheelName: '其他转盘', mode: 'normal', resultId: 'summary-other-item', resultName: '其他项', createdAt: '2026-07-29T12:00:00', updatedAt: '2026-07-29T12:00:00' },
        ],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        window.__wheelSummaryBefore = localStorage.getItem('lifePlanData');
    }, source);
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();
    const summary = page.locator('.wheel-management-summary');
    await expect(summary).toContainText('1可抽标签');
    await expect(summary).toContainText('1公共项');
    await expect(summary).toContainText('1标签');
    await expect(summary).toContainText('2记录');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData') === window.__wheelSummaryBefore)).toBe(true);
});

test('wheel management list filters modes and exposes card actions', async ({ page }) => {
    const source = emptyData({
        wheels: [
            { id: 'wheel-list-normal', name: '普通列表盘', mode: 'normal', items: [{ id: 'list-normal-item', name: '普通项', note: '', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }], createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
            { id: 'wheel-list-tag', name: '标签列表盘', mode: 'tag', tagIds: [], items: [], createdAt: '2026-07-29T09:00:00', updatedAt: '2026-07-29T09:00:00' },
        ],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();
    const list = page.locator('.wheel-list-management');
    await expect(list.locator('.wheel-list-card')).toHaveCount(2);
    await list.getByRole('button', { name: '标签', exact: true }).click();
    await expect(list.locator('.wheel-list-card')).toHaveCount(1);
    await list.getByRole('button', { name: '全部', exact: true }).click();
    const normalCard = list.locator('.wheel-list-card').filter({ hasText: '普通列表盘' });
    page.once('dialog', dialog => dialog.accept('重命名后的普通盘'));
    await normalCard.getByRole('button', { name: '重命名' }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).wheels.find(wheel => wheel.id === 'wheel-list-normal').name)).toBe('重命名后的普通盘');
    await list.locator('.wheel-list-card').filter({ hasText: '重命名后的普通盘' }).getByRole('button', { name: '打开' }).click();
    await expect(page.locator('.wheel-stage-title')).toContainText('重命名后的普通盘');
});

test('wheel history workspace shows all rows and converts a result to todo', async ({ page }) => {
    const history = Array.from({ length: 9 }, (_, index) => ({
        id: `history-row-${index}`,
        wheelId: 'wheel-history-all',
        wheelName: '完整历史盘',
        mode: 'normal',
        resultId: `history-result-${index}`,
        resultName: `历史结果 ${index}`,
        note: '',
        convertedTodoId: '',
        createdAt: `2026-07-29T0${index}:00:00`,
        updatedAt: `2026-07-29T0${index}:00:00`,
    }));
    const source = emptyData({
        wheels: [{ id: 'wheel-history-all', name: '完整历史盘', mode: 'normal', items: [{ id: 'history-option', name: '选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }], createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
        wheelHistory: history,
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '记录/备份' }).click();
    const panel = page.locator('#wheel-history-panel');
    await expect(panel.locator('.history-row')).toHaveCount(9);
    await expect(panel.getByRole('button', { name: '导出 JSON' })).toBeVisible();
    await expect(panel.locator('.history-row').first()).toContainText('历史结果 8');
    await expect(panel.locator('.history-row').first()).toContainText('2026年7月29日 08:00:00');
    await panel.locator('.history-row').filter({ hasText: '历史结果 0' }).getByRole('button', { name: '转入待办' }).click();
    await expect(panel.locator('.history-row').filter({ hasText: '历史结果 0' })).toContainText('已转待办');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.todos).toEqual(expect.arrayContaining([expect.objectContaining({ text: '历史结果 0', group: '转盘' })]));
});

test('wheel backup restore remaps duplicate tags and assigns orphan public items', async ({ page }) => {
    const source = emptyData({
        wheels: [{ id: 'wheel-restore-normalize', name: '恢复盘', mode: 'normal', items: [], createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
    });
    const incoming = {
        wheels: [{ id: 'wheel-restore-tag', name: '恢复标签盘', mode: 'tag', tagIds: ['tag-duplicate'], items: [], createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
        wheelTags: [
            { id: 'tag-keep', name: '学习', color: '#216e4e', weight: 1, enabled: true },
            { id: 'tag-duplicate', name: '学习', color: '#4f7cac', weight: 2, enabled: true },
        ],
        wheelLibraryItems: [{ id: 'library-orphan', name: '未分类公共项', note: '', tagIds: [], weight: 1, enabled: true }],
        wheelHistory: [],
    };
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '记录/备份' }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#wheel-history-panel input[type="file"]').setInputFiles({ name: 'wheel-restore.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming), 'utf8') });
    await expect(page.getByLabel('当前转盘').first()).toHaveValue('wheel-restore-tag');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelTags.filter(tag => tag.name === '学习')).toHaveLength(1);
    const uncategorized = stored.wheelTags.find(tag => tag.name === '未分类');
    expect(uncategorized).toBeTruthy();
    expect(stored.wheelLibraryItems[0].tagIds).toEqual([uncategorized.id]);
    expect(stored.wheels[0].tagIds).toEqual(['tag-keep']);
});

test('wheel create editor adds weighted rows without textarea parsing', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/wheel');
    await page.locator('.wheel-empty-shell').getByRole('button', { name: '新建转盘' }).click();
    const form = page.locator('#wheel-create-panel');
    await form.getByLabel('名称').fill('动态选项盘');
    await form.getByLabel('选项 1').fill('阅读');
    await form.getByLabel('选项权重').fill('2');
    await form.getByRole('button', { name: '添加选项' }).click();
    await form.getByRole('textbox', { name: '选项 2' }).fill('散步');
    await form.getByRole('button', { name: '创建转盘' }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheels[0]).toMatchObject({ name: '动态选项盘', mode: 'normal' });
    expect(stored.wheels[0].items).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: '阅读', weight: 2 }),
        expect.objectContaining({ name: '散步', weight: 1 }),
    ]));
});

test('wheel empty state keeps a no-write canvas stage and create entry', async ({ page }) => {
    const source = emptyData();
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        window.__wheelEmptyBefore = localStorage.getItem('lifePlanData');
    }, source);

    await page.goto('/#/wheel');
    const empty = page.locator('.wheel-empty-shell');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('还没有转盘');
    await expect(empty.locator('.wheel-canvas-wrap')).toBeVisible();
    await empty.getByRole('button', { name: '新建转盘' }).click();
    await expect(page.locator('#wheel-create-panel')).toBeInViewport();
    const unchanged = await page.evaluate(() => window.__wheelEmptyBefore === localStorage.getItem('lifePlanData'));
    expect(unchanged).toBe(true);
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
    page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('records:2');
        expect(dialog.message()).toContain('todos:1');
        await dialog.accept();
    });
    await page.getByLabel('导入并合并').setInputFiles({
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
    await page.getByRole('main').getByRole('button', { name: '导出备份' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^人生规划备份_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/);
    const afterExport = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'));
    expect(afterExport.map(snapshot => snapshot.reason)).toContain('手动导出备份');
});

test('main export preserves data and legacy snapshot metadata', async ({ page }) => {
    const source = emptyData({
        records: [{ id: 'export-metadata-record', type: '日记', title: '导出记录', content: '正文', startDate: '2026-07-28', endDate: '2026-07-28' }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/sync');
    const beforeExport = await page.evaluate(() => localStorage.getItem('lifePlanData'));
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('main').getByRole('button', { name: '导出备份' }).click();
    const download = await downloadPromise;
    const exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    const state = await page.evaluate(() => ({
        data: localStorage.getItem('lifePlanData'),
        snapshots: JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'),
    }));
    const snapshot = state.snapshots[0];
    const exportedHash = await page.evaluate(data => window.LifePlanSyncService.create().getDataHash(data), exported);
    expect(state.data).toBe(beforeExport);
    expect(snapshot).toMatchObject({ reason: '手动导出备份', source: 'local', action: '' });
    expect(snapshot.hash).toBe(exportedHash);
    expect(snapshot.hash).toBeTruthy();
});

test('main import schedules the shared auto-sync notification', async ({ page }) => {
    const local = emptyData({ records: [{ id: 'import-schedule-local', type: '日记', title: '导入前', content: '', startDate: '2026-07-28', endDate: '2026-07-28', todoIds: [] }] });
    const imported = emptyData({ records: [{ id: 'import-schedule-new', type: '工作记录', title: '导入后', content: '', startDate: '2026-07-29', endDate: '2026-07-29', todoIds: [] }] });
    await page.addInitScript(({ localData }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: true }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false }));
        const realSetTimeout = window.setTimeout.bind(window);
        window.__mainAutoSyncSchedules = [];
        window.setTimeout = (callback, delay, ...args) => {
            if (delay === 20000) {
                window.__mainAutoSyncSchedules.push(delay);
                return realSetTimeout(() => undefined, 60000);
            }
            return realSetTimeout(callback, delay, ...args);
        };
    }, { localData: local });
    await page.goto('/#/sync');
    page.once('dialog', dialog => dialog.accept());
    await page.getByLabel('导入并合并').setInputFiles({
        name: 'import-auto-sync.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(imported), 'utf8'),
    });
    await expect.poll(() => page.evaluate(() => window.__mainAutoSyncSchedules.length)).toBe(1);
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSyncState')));
    expect(state.dirty).toBe(true);
});

test('main import confirmation cancellation keeps data and snapshots unchanged', async ({ page }) => {
    const source = emptyData({
        records: [{ id: 'import-cancel-local', type: '日记', title: '导入前记录', content: '', startDate: '2026-07-28', endDate: '2026-07-28', todoIds: [] }],
    });
    const imported = emptyData({
        records: [{ id: 'import-cancel-incoming', type: '日记', title: '不应导入记录', content: '', startDate: '2026-07-29', endDate: '2026-07-29', todoIds: [] }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/sync');

    const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.getByLabel('导入并合并').setInputFiles({
            name: 'import-cancel.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(imported), 'utf8'),
        }),
    ]);
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('records:1');
    await dialog.dismiss();
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanSnapshots'))).toBeNull();
});

test('main import summary normalizes legacy shadow records before confirmation', async ({ page }) => {
    const local = emptyData({
        records: [{ id: 'import-summary-local', type: '日记', title: '本机记录', content: '', startDate: '2026-07-28', endDate: '2026-07-28' }],
    });
    const imported = emptyData({
        records: [{ id: 'import-summary-shadow', type: '习惯打卡', title: '不应进入主记录', isHabitRecord: true, content: '', startDate: '2026-07-27', endDate: '2026-07-27' }],
    });
    await page.addInitScript(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), local);
    await page.goto('/#/sync');
    page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('records:0');
        await dialog.dismiss();
    });
    await page.getByLabel('导入并合并').setInputFiles({
        name: 'import-normalized-summary.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(imported), 'utf8'),
    });
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(JSON.stringify(local));
});

test('main import cancels when the before-import snapshot cannot be saved', async ({ page }) => {
    const source = emptyData({
        records: [{ id: 'import-snapshot-failure-local', type: '日记', title: '导入前记录', content: '保留原文', startDate: '2026-07-28', endDate: '2026-07-28', todoIds: [] }],
    });
    const imported = emptyData({
        records: [{ id: 'import-snapshot-failure-incoming', type: '工作记录', title: '不应导入记录', content: '不应写入', startDate: '2026-07-29', endDate: '2026-07-29', todoIds: [] }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        const realSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function blockedSnapshotWrite(key, value) {
            if (key === 'lifePlanSnapshots') throw new Error('snapshot write blocked');
            return realSetItem.call(this, key, value);
        };
    }, source);

    await page.goto('/#/sync');
    const dialogs = [];
    page.on('dialog', async dialog => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        if (dialogs.length === 1) await dialog.accept();
        else await dialog.dismiss();
    });
    await page.getByLabel('导入并合并').setInputFiles({
        name: 'import-before-snapshot-failure.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(imported), 'utf8'),
    });

    await expect(page.locator('.sync-status.active')).toContainText('导入前快照创建失败');
    expect(dialogs).toEqual([
        expect.objectContaining({ type: 'confirm' }),
        expect.objectContaining({ type: 'confirm', message: expect.stringContaining('导入前快照创建失败') }),
    ]);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanSnapshots'))).toBeNull();
});

test('main import can continue after confirming a missing before-import snapshot', async ({ page }) => {
    const source = emptyData({
        records: [{ id: 'import-snapshot-continue-local', type: '日记', title: '导入前记录', content: '保留原文', startDate: '2026-07-28', endDate: '2026-07-28', todoIds: [] }],
    });
    const imported = emptyData({
        records: [{ id: 'import-snapshot-continue-incoming', type: '工作记录', title: '继续导入记录', content: '应写入', startDate: '2026-07-29', endDate: '2026-07-29', todoIds: [] }],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        const realSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function blockedSnapshotWrite(key, value) {
            if (key === 'lifePlanSnapshots') throw new Error('snapshot write blocked');
            return realSetItem.call(this, key, value);
        };
    }, source);

    await page.goto('/#/sync');
    const dialogs = [];
    page.on('dialog', async dialog => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        await dialog.accept();
    });
    await page.getByLabel('导入并合并').setInputFiles({
        name: 'import-before-snapshot-continue.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(imported), 'utf8'),
    });

    await expect(page.locator('.sync-status.active')).toContainText('导入已按合并规则完成');
    expect(dialogs).toEqual([
        expect.objectContaining({ type: 'confirm' }),
        expect.objectContaining({ type: 'confirm', message: expect.stringContaining('导入前快照创建失败') }),
    ]);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records.some(record => record.id === 'import-snapshot-continue-incoming')).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanSnapshots'))).toBeNull();
});

test('sync config removes legacy credential fields when saved', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
        webdavUrl: '', remotePath: '/life-plan.json', autoSync: false, username: 'legacy-user', password: 'legacy-password',
    })));
    await page.goto('/#/sync');
    await page.getByRole('button', { name: '保存配置' }).click();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSyncConfig')));
    expect(stored).toEqual({ webdavUrl: '', remotePath: '/life-plan.json', autoSync: false });
    expect(stored.username).toBeUndefined();
    expect(stored.password).toBeUndefined();
});

test('sync config preserves the legacy AppSyncKit provider flag', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
        webdavUrl: '', remotePath: '/life-plan.json', autoSync: false, useAppSyncKitProvider: true,
    })));
    await page.goto('/#/sync');
    await page.getByRole('button', { name: '保存配置' }).click();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSyncConfig')));
    expect(stored.useAppSyncKitProvider).toBe(true);
});

test('main manual pull keeps dirty state when the merged result differs from cloud', async ({ page }) => {
    const localData = emptyData({
        records: [{ id: 'local-pull-record', type: '日记', title: '本机独有记录', content: '', startDate: '2026-07-27', endDate: '2026-07-27', todoIds: [] }],
    });
    const remoteData = emptyData({
        records: [{ id: 'remote-pull-record', type: '日记', title: '云端独有记录', content: '', startDate: '2026-07-28', endDate: '2026-07-28', todoIds: [] }],
    });
    await page.addInitScript(({ data }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: true, lastRemoteHash: 'old-remote', lastSyncAt: 'previous-sync' }));
    }, { data: localData });
    await page.route('https://sync.example.test/life-plan.json', async route => {
        if (route.request().method() !== 'GET') return route.fulfill({ status: 405, body: 'method not allowed' });
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { ETag: '"pull-remote"' },
            body: JSON.stringify(remoteData),
        });
    });

    await page.goto('/#/sync');
    await page.getByRole('button', { name: '下载并合并' }).click();
    await expect(page.locator('.sync-status')).toContainText('已按原 mergeCloudData 规则合并云端数据');

    const result = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        state: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(result.data.records.map(item => item.id)).toEqual(expect.arrayContaining(['local-pull-record', 'remote-pull-record']));
    expect(result.state.dirty).toBe(true);
    expect(result.state.lastSyncAt).toBe('previous-sync');
    expect(result.state.lastRemoteHash).not.toBe('old-remote');
});

test('fitness browse index exposes read-only section summaries and jump actions', async ({ page }) => {
    await page.goto('/#/fitness');

    const browse = page.locator('.fitness-browse-index');
    await expect(browse).toBeVisible();
    await expect(browse.locator('.fitness-browse-item')).toHaveCount(4);
    await expect(browse).toContainText('训练计划');
    await expect(browse).toContainText('训练历史');
    await expect(browse).toContainText('身材记录');
    await expect(browse).toContainText('动作库');
    await browse.getByRole('button', { name: '查看' }).nth(3).click();
    await expect(page.locator('#fitness-library-section')).toBeInViewport();
});

test('fitness browse plan rows expose legacy exercise summaries', async ({ page }) => {
    const source = emptyData({
        fitnessPlans: [{
            id: 'fitness-browse-plan',
            name: '推拉腿计划',
            status: 'paused',
            goal: 'strength',
            notes: '训练前先热身',
            exercises: [
                { id: 'browse-squat', name: '深蹲', targetSets: 3, sets: [{ weight: 80, reps: 5 }, { weight: 80, reps: 5 }, { weight: 80, reps: 5 }] },
                { id: 'browse-bench', name: '卧推', targetSets: 4, sets: [{ weight: 60, reps: 6 }, { weight: 60, reps: 6 }, { weight: 60, reps: 6 }, { weight: 60, reps: 6 }] },
                { id: 'browse-row', name: '划船', targetSets: 3, targetWeight: 45, sets: [] },
                { id: 'browse-pull', name: '引体', targetSets: 3, targetReps: '8', sets: [] },
                { id: 'browse-curl', name: '弯举', targetSets: 2, targetReps: '12', sets: [] },
                { id: 'browse-plank', name: '平板支撑', targetSets: 2, targetReps: '45秒', sets: [] },
            ],
        }],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'fitness-browse-before' }));
    }, source);

    await page.goto('/#/fitness');
    const row = page.locator('.fitness-plan-browse-row').filter({ hasText: '推拉腿计划' });
    await expect(row).toContainText('暂停');
    await expect(row).toContainText('力量 · 6 个动作');
    await expect(row).toContainText('深蹲 · 3×80kg/5');
    await expect(row).toContainText('卧推 · 4×60kg/6');
    await expect(row).toContainText('划船 · 3×45kg');
    await expect(row).toContainText('+1');
    await expect(row).toContainText('训练前先热身');
    await expect(row.getByRole('button', { name: '按计划开练' })).toBeVisible();
    await expect(row.getByRole('button', { name: '编辑' })).toBeVisible();
});

test('fitness plan browse content opens the legacy editor entry point', async ({ page }) => {
    const source = emptyData({
        fitnessPlans: [{ id: 'fitness-browse-edit', name: '可点击计划', status: 'active', goal: 'strength', notes: '计划备注', exercises: [{ name: '深蹲', targetSets: 3, targetReps: '5', sets: [] }] }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/fitness');
    const row = page.locator('.fitness-plan-browse-row').filter({ hasText: '可点击计划' });
    await row.locator('.fitness-plan-browse-main').click();
    const editor = page.locator('form.card').filter({ hasText: '编辑训练计划' });
    await expect(editor).toBeVisible();
    await expect(editor.locator('.form-group').filter({ hasText: '计划名称' }).locator('input')).toHaveValue('可点击计划');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(JSON.stringify(source));
});

test('fitness plan deletion keeps the legacy confirmation guard', async ({ page }) => {
    const source = emptyData({
        fitnessPlans: [{ id: 'fitness-delete-confirm', name: '待删除计划', status: 'active', exercises: [{ name: '深蹲', targetSets: 3, sets: [] }] }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/fitness');
    const row = page.locator('.fitness-plan-browse-row').filter({ hasText: '待删除计划' });
    page.once('dialog', async dialog => {
        expect(dialog.message()).toBe('确定删除这个训练计划吗？');
        await dialog.dismiss();
    });
    await row.getByRole('button', { name: '删除', exact: true }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).fitnessPlans)).toHaveLength(1);

    page.once('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.locator('.notice.success')).toContainText('训练计划已删除');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.fitnessPlans).toHaveLength(0);
    expect(stored.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'fitnessPlans', id: 'fitness-delete-confirm', reason: 'manual-delete' }),
    ]));
});

test('fitness hero secondary actions jump to body and workout forms', async ({ page }) => {
    await page.goto('/#/fitness');

    const actions = page.locator('.fitness-page-header .fitness-header-actions');
    await actions.getByRole('button', { name: '记录身材' }).click();
    await expect(page.locator('#fitness-body-section')).toBeInViewport();
    await actions.getByRole('button', { name: '补记训练' }).click();
    await expect(page.locator('#fitness-workout-section')).toBeInViewport();
});

test('fitness overview hero exposes legacy secondary actions', async ({ page }) => {
    await page.goto('/#/fitness');

    const hero = page.locator('.fitness-overview-hero');
    const actions = hero.locator('.fitness-overview-secondary');
    await expect(actions.getByRole('button', { name: '记录身材' })).toBeVisible();
    await expect(actions.getByRole('button', { name: '管理计划' })).toBeVisible();

    await actions.getByRole('button', { name: '记录身材' }).click();
    await expect(page.locator('#fitness-body-section')).toBeInViewport();
    await expect(page.locator('#fitness-body-section')).toHaveAttribute('open', '');

    await actions.getByRole('button', { name: '管理计划' }).click();
    await expect(page.locator('#fitness-plan-section')).toBeInViewport();
    await expect(page.locator('#fitness-library-section details').nth(1)).toHaveAttribute('open', '');
});

test('fitness overview renders service-backed body metric trends without writes', async ({ page }) => {
    const source = emptyData({
        bodyMetrics: [
            { id: 'metric-trend-old', date: '2026-07-29', weight: 70, waist: 82, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' },
            { id: 'metric-trend-new', date: '2026-07-31', weight: 71.5, waist: 81.5, createdAt: '2026-07-31T08:00:00', updatedAt: '2026-07-31T08:00:00' },
        ],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'fitness-trend-before' }));
        window.__fitnessTrendBefore = localStorage.getItem('lifePlanData');
    }, source);

    await page.goto('/#/fitness');
    const trends = page.locator('.fitness-trend-summary');
    await expect(trends).toContainText('近 30 天体重变化');
    await expect(trends.locator('.fitness-trend-summary-card').filter({ hasText: '体重' })).toContainText('+1.5 kg');
    await expect(trends.locator('.fitness-trend-summary-card').filter({ hasText: '腰围' })).toContainText('-0.5 cm');
    const charts = page.locator('.fitness-trend-grid');
    await expect(charts.locator('.fitness-trend-card').filter({ hasText: '体重趋势' })).toContainText('2026-07-29');
    await expect(charts.locator('.fitness-trend-card').filter({ hasText: '体重趋势' })).toContainText('71.5');
    await expect(charts.locator('.fitness-trend-card').filter({ hasText: '腰围趋势' })).toContainText('81.5');
    await expect(charts.locator('svg.fitness-sparkline')).toHaveCount(2);
    const unchanged = await page.evaluate(() => ({
        sameData: window.__fitnessTrendBefore === localStorage.getItem('lifePlanData'),
        mirror: localStorage.getItem('fitnessAppData'),
    }));
    expect(unchanged.sameData).toBe(true);
    expect(unchanged.mirror).toBeNull();
});

test('fitness hero follows the legacy service recommendation and free fallback', async ({ page }) => {
    const source = emptyData({
        fitnessPlans: [
            { id: 'fitness-archived-empty', name: '归档空计划', status: 'archived', exercises: [] },
            { id: 'fitness-active-plan', name: '今日力量计划', status: 'active', exercises: [{ name: '深蹲', sets: [{ weight: 80, reps: 5 }] }] },
        ],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'fitness-hero-before' }));
    }, source);

    await page.goto('/#/fitness');
    const hero = page.locator('.fitness-overview-hero');
    await expect(hero).toContainText('今天还没开练，可以直接按计划开始');
    await expect(hero.getByRole('button', { name: '按计划开练：今日力量计划' })).toBeVisible();
    await expect(hero).not.toContainText('归档空计划');

    await page.evaluate(() => localStorage.setItem('lifePlanData', JSON.stringify({
        ...JSON.parse(localStorage.getItem('lifePlanData') || '{}'),
        fitnessPlans: [],
    })));
    const fallbackPage = await page.context().newPage();
    await fallbackPage.goto('/#/fitness');
    await expect(fallbackPage.locator('.fitness-overview-hero').getByRole('button', { name: '自由开练' })).toBeVisible();
    await fallbackPage.close();
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
    await page.locator('.fitness-page-header .fitness-header-actions').getByRole('button', { name: '新建计划' }).click();
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

    page.once('dialog', dialog => dialog.accept());
    await page.locator('article.card').filter({ hasText: '开始计划训练' }).locator('.fitness-metric-row').filter({ hasText: '力量计划' }).getByRole('button', { name: '删除' }).click();
    const afterDelete = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(afterDelete.fitnessPlans).toHaveLength(0);
    expect(afterDelete.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'fitnessPlans', id: stored.data.fitnessPlans[0].id, reason: 'manual-delete' }),
    ]));
});

test('fitness zero-completion finish keeps the legacy confirmation guard', async ({ page }) => {
    const source = emptyData({
        fitnessWorkouts: [{
            id: 'workout-zero-completion', date: '2026-08-01', status: 'inProgress', title: '零完成训练',
            planId: '', planName: '', durationMin: 0, notes: '',
            exercises: [{
                id: 'exercise-zero-completion', name: '空杠深蹲', targetSets: 1, targetReps: '5', targetWeight: 20,
                restSec: 90, note: '', plannedSets: [],
                sets: [{ id: 'set-zero-completion', weight: 20, reps: 5, done: false }],
            }],
            createdAt: '2026-08-01T08:00:00', updatedAt: '2026-08-01T08:00:00',
        }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/fitness');
    await expect(page.getByText('正在训练：零完成训练')).toBeVisible();

    page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('还没有任何完成组');
        await dialog.dismiss();
    });
    await page.getByRole('button', { name: '结束训练' }).click();
    await expect(page.getByText('正在训练：零完成训练')).toBeVisible();
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.fitnessWorkouts[0].status).toBe('inProgress');

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '结束训练' }).click();
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).fitnessWorkouts[0].status)).toBe('done');
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.fitnessWorkouts[0].status).toBe('done');
});

test('fitness history shows every normalized workout status', async ({ page }) => {
    const source = emptyData({
        fitnessWorkouts: [
            { id: 'workout-progress-history', date: '2026-07-29', status: 'inProgress', title: '进行中训练', exercises: [], createdAt: '2026-07-29T10:00:00', updatedAt: '2026-07-29T10:00:00' },
            { id: 'workout-done-history', date: '2026-07-28', status: 'done', title: '完成训练', exercises: [], createdAt: '2026-07-28T10:00:00', updatedAt: '2026-07-28T10:00:00' },
            { id: 'workout-skipped-history', date: '2026-07-27', status: 'skipped', title: '跳过训练', exercises: [], createdAt: '2026-07-27T10:00:00', updatedAt: '2026-07-27T10:00:00' },
        ],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);

    await page.goto('/#/fitness');
    const history = page.locator('article.card').filter({ hasText: '训练历史' });
    const rows = history.locator('.fitness-metric-row');
    await expect(rows).toHaveCount(3);
    await expect(rows).toContainText(['进行中训练', '完成训练', '跳过训练']);
});

test('fitness history editor saves edits through the legacy workout contract', async ({ page }) => {
    const source = emptyData({
        exerciseLibrary: [
            { id: 'ex-row', name: '坐姿划船', muscle: 'back', defaultSets: 2, defaultReps: '10', defaultWeight: 45, restSec: 90, createdAt: '2026-07-28T07:00:00', updatedAt: '2026-07-28T07:00:00' },
        ],
        fitnessPlans: [{
            id: 'plan-row', name: '背部训练', goal: 'hypertrophy', status: 'active', weekdays: [], notes: '', createdAt: '2026-07-28T07:00:00', updatedAt: '2026-07-28T07:00:00',
            exercises: [{ id: 'plan-row-ex', name: '坐姿划船', targetSets: 2, targetReps: '10', targetWeight: 45, restSec: 90, note: '', sets: [{ id: 'row-set-1', weight: 45, reps: 10 }, { id: 'row-set-2', weight: 47.5, reps: 10 }] }],
            days: [{ id: 'plan-row-day', name: '训练', exercises: [{ id: 'plan-row-ex', name: '坐姿划船', targetSets: 2, targetReps: '10', targetWeight: 45, restSec: 90, note: '', sets: [{ id: 'row-set-1', weight: 45, reps: 10 }, { id: 'row-set-2', weight: 47.5, reps: 10 }] }] }],
        }],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'fitness-history-before' }));
    }, source);

    await page.goto('/#/fitness');
    await page.locator('.fitness-page-header .fitness-header-actions').getByRole('button', { name: '补记训练' }).click();
    let historyForm = page.locator('form.card').filter({ hasText: '补记训练日志' });
    await historyForm.locator('.form-group').filter({ hasText: '训练日期' }).locator('input').fill('2026-07-28');
    await historyForm.locator('.form-group').filter({ hasText: '状态' }).locator('select').selectOption('done');
    page.once('dialog', dialog => dialog.accept());
    await historyForm.locator('.form-group').filter({ hasText: '关联计划' }).locator('select').selectOption('plan-row');
    await historyForm.locator('.form-group').filter({ hasText: '训练标题' }).locator('input').fill('补记背部训练');
    await historyForm.locator('.form-group').filter({ hasText: '时长 分钟' }).locator('input').fill('48');
    await historyForm.locator('.form-group').filter({ hasText: '训练备注' }).locator('input').fill('补记完成');
    await historyForm.locator('.fitness-workout-set-row').nth(0).locator('input').nth(0).fill('50');
    await historyForm.locator('.fitness-workout-set-row').nth(0).locator('input').nth(1).fill('9');
    await historyForm.locator('.fitness-workout-set-row').nth(0).locator('input[type="checkbox"]').check();
    await historyForm.getByRole('button', { name: '保存训练日志' }).click();
    await expect(page.locator('.notice.success')).toContainText('训练日志已保存');

    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
        fitnessMirror: localStorage.getItem('fitnessAppData'),
    }));
    expect(stored.data.fitnessWorkouts).toHaveLength(1);
    const workoutId = stored.data.fitnessWorkouts[0].id;
    expect(stored.data.fitnessWorkouts[0]).toEqual(expect.objectContaining({
        date: '2026-07-28',
        status: 'done',
        title: '补记背部训练',
        durationMin: 48,
        planId: 'plan-row',
        planName: '背部训练',
    }));
    expect(stored.data.fitnessWorkouts[0].exercises[0].plannedSets[0]).toEqual(expect.objectContaining({ weight: 45, reps: 10 }));
    expect(stored.data.fitnessWorkouts[0].exercises[0].sets[0]).toEqual(expect.objectContaining({ weight: 50, reps: 9, done: true }));
    expect(stored.syncState.dirty).toBe(true);
    expect(stored.fitnessMirror).toBeNull();

    await page.locator('article.card').filter({ hasText: '训练历史' }).locator('.fitness-metric-row').filter({ hasText: '补记背部训练' }).getByRole('button', { name: '编辑' }).click();
    historyForm = page.locator('form.card').filter({ hasText: '编辑训练日志' });
    await historyForm.locator('.form-group').filter({ hasText: '训练标题' }).locator('input').fill('编辑后的背部训练');
    await historyForm.locator('.fitness-workout-set-row').nth(1).locator('input').nth(0).fill('52.5');
    await historyForm.locator('.fitness-workout-set-row').nth(1).locator('input').nth(1).fill('8');
    await historyForm.locator('.fitness-workout-set-row').nth(1).locator('input[type="checkbox"]').check();
    await historyForm.getByRole('button', { name: '保存训练日志' }).click();
    await expect(page.locator('.notice.success')).toContainText('训练日志已更新');

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.fitnessWorkouts).toHaveLength(1);
    expect(stored.fitnessWorkouts[0].id).toBe(workoutId);
    expect(stored.fitnessWorkouts[0].title).toBe('编辑后的背部训练');
    expect(stored.fitnessWorkouts[0].exercises[0].sets[1]).toEqual(expect.objectContaining({ weight: 52.5, reps: 8, done: true }));

    await page.locator('article.card').filter({ hasText: '训练历史' }).locator('.fitness-metric-row').filter({ hasText: '编辑后的背部训练' }).getByRole('button', { name: '删除' }).click();
    const afterDelete = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(afterDelete.fitnessWorkouts).toHaveLength(0);
    expect(afterDelete.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'fitnessWorkouts', id: workoutId, reason: 'manual-delete' }),
    ]));
});

test('fitness workout plan changes confirm before replacing manual exercises', async ({ page }) => {
    const source = emptyData({
        exerciseLibrary: [{ id: 'fitness-confirm-library', name: '计划动作', muscle: 'legs', defaultSets: 2, defaultReps: '8', defaultWeight: 40, restSec: 90 }],
        fitnessPlans: [{
            id: 'fitness-confirm-plan', name: '确认计划', goal: 'strength', status: 'active', notes: '',
            exercises: [{ id: 'fitness-confirm-exercise', name: '计划动作', targetSets: 2, targetReps: '8', targetWeight: 40, sets: [{ weight: 40, reps: 8 }, { weight: 40, reps: 8 }] }],
        }],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/fitness');
    await page.locator('.fitness-page-header .fitness-header-actions').getByRole('button', { name: '补记训练' }).click();
    const form = page.locator('form.card').filter({ hasText: '补记训练日志' });
    await form.locator('.form-group').filter({ hasText: '训练日期' }).locator('input').fill('2026-07-28');
    await form.locator('.form-group').filter({ hasText: '状态' }).locator('select').selectOption('skipped');
    await form.locator('.form-group').filter({ hasText: '训练标题' }).locator('input').fill('手动标题');
    await form.locator('.form-group').filter({ hasText: '训练备注' }).locator('input').fill('手动备注');
    const exerciseName = form.locator('.fitness-plan-exercise-card').first().locator('input[placeholder="动作名称"]');
    await exerciseName.fill('手动动作');
    const planSelect = form.locator('.form-group').filter({ hasText: '关联计划' }).locator('select');
    page.once('dialog', async dialog => {
        expect(dialog.message()).toBe('要用该计划的动作覆盖当前编辑内容吗？');
        await dialog.dismiss();
    });
    await planSelect.selectOption('fitness-confirm-plan');
    await expect(planSelect).toHaveValue('fitness-confirm-plan');
    await expect(exerciseName).toHaveValue('手动动作');

    await planSelect.selectOption('');
    page.once('dialog', dialog => dialog.accept());
    await planSelect.selectOption('fitness-confirm-plan');
    await expect(exerciseName).toHaveValue('计划动作');
    await expect(form.locator('.form-group').filter({ hasText: '训练日期' }).locator('input')).toHaveValue('2026-07-28');
    await expect(form.locator('.form-group').filter({ hasText: '状态' }).locator('select')).toHaveValue('skipped');
    await expect(form.locator('.form-group').filter({ hasText: '训练标题' }).locator('input')).toHaveValue('手动标题');
    await expect(form.locator('.form-group').filter({ hasText: '训练备注' }).locator('input')).toHaveValue('手动备注');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(JSON.stringify(source));
});

test('fitness body metrics edit every legacy field through the shared service', async ({ page }) => {
    const source = emptyData();
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'fitness-body-before' }));
    }, source);

    await page.goto('/#/fitness');
    await page.locator('.fitness-page-header .fitness-header-actions').getByRole('button', { name: '记录身材' }).click();
    let metricForm = page.locator('form.card').filter({ hasText: '记录身材' });
    await metricForm.locator('.form-group').filter({ hasText: '日期' }).locator('input').fill('2026-07-29');
    await metricForm.locator('.form-group').filter({ hasText: '测量状态' }).locator('select').selectOption('afterMeal');
    for (const [label, value] of [
        ['体重', '72.4'],
        ['体脂', '18.2'],
        ['胸围', '98.5'],
        ['腰围', '82'],
        ['臀围', '96'],
        ['臂围', '34.5'],
        ['大腿围', '57'],
        ['小腿围', '38.2'],
        ['肩围', '112'],
        ['身高', '176.5'],
    ]) {
        await metricForm.locator('.form-group').filter({ hasText: label }).locator('input').fill(value);
    }
    await metricForm.locator('.form-group').filter({ hasText: '备注' }).locator('input').fill('全字段记录');
    await metricForm.getByRole('button', { name: '记录身材' }).click();
    await expect(page.locator('.notice.success')).toContainText('身体指标已保存');
    await expect(page.locator('.fitness-body-metric-row')).toContainText('胸围 98.5 cm');
    await expect(page.locator('.fitness-body-metric-row')).toContainText('小腿围 38.2 cm');

    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
        fitnessMirror: localStorage.getItem('fitnessAppData'),
    }));
    expect(stored.data.bodyMetrics).toHaveLength(1);
    const metricId = stored.data.bodyMetrics[0].id;
    expect(stored.data.bodyMetrics[0]).toEqual(expect.objectContaining({
        date: '2026-07-29',
        condition: 'afterMeal',
        weight: 72.4,
        bodyFat: 18.2,
        chest: 98.5,
        waist: 82,
        hips: 96,
        arm: 34.5,
        thigh: 57,
        calf: 38.2,
        shoulder: 112,
        height: 176.5,
        note: '全字段记录',
    }));
    expect(stored.syncState.dirty).toBe(true);
    expect(stored.fitnessMirror).toBeNull();

    await page.locator('.fitness-body-metric-row').getByRole('button', { name: '编辑' }).click();
    metricForm = page.locator('form.card').filter({ hasText: '编辑身材记录' });
    await expect(metricForm.locator('.form-group').filter({ hasText: '胸围' }).locator('input')).toHaveValue('98.5');
    await expect(metricForm.locator('.form-group').filter({ hasText: '小腿围' }).locator('input')).toHaveValue('38.2');
    await metricForm.locator('.form-group').filter({ hasText: '测量状态' }).locator('select').selectOption('fasted');
    await metricForm.locator('.form-group').filter({ hasText: '胸围' }).locator('input').fill('99');
    await metricForm.locator('.form-group').filter({ hasText: '小腿围' }).locator('input').fill('39');
    await metricForm.locator('.form-group').filter({ hasText: '备注' }).locator('input').fill('编辑后记录');
    await metricForm.getByRole('button', { name: '保存修改' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.bodyMetrics).toHaveLength(1);
    expect(stored.bodyMetrics[0]).toEqual(expect.objectContaining({ id: metricId, condition: 'fasted', chest: 99, calf: 39, note: '编辑后记录' }));

    await page.locator('.fitness-body-metric-row').getByRole('button', { name: '删除' }).click();
    const afterDelete = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(afterDelete.bodyMetrics).toHaveLength(0);
    expect(afterDelete.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'bodyMetrics', id: metricId, reason: 'manual-delete' }),
    ]));
});

test('fitness live workout suggestions and rest timer stay service backed', async ({ page }) => {
    const source = emptyData({
        exerciseLibrary: [
            { id: 'ex-live', name: '卧推建议', muscle: 'chest', defaultSets: 2, defaultReps: '6', defaultWeight: 50, restSec: 90, createdAt: '2026-07-29T07:00:00', updatedAt: '2026-07-29T07:00:00' },
        ],
        fitnessPlans: [{
            id: 'plan-live', name: '实时训练计划', goal: 'strength', status: 'active', weekdays: [], notes: '', createdAt: '2026-07-29T07:10:00', updatedAt: '2026-07-29T07:10:00',
            exercises: [{ id: 'plan-live-ex', name: '卧推建议', targetSets: 2, targetReps: '6', targetWeight: 50, restSec: 90, note: '', sets: [{ id: 'live-set-1', weight: 50, reps: 6 }, { id: 'live-set-2', weight: 52.5, reps: 6 }] }],
            days: [{ id: 'plan-live-day', name: '训练', exercises: [{ id: 'plan-live-ex', name: '卧推建议', targetSets: 2, targetReps: '6', targetWeight: 50, restSec: 90, note: '', sets: [{ id: 'live-set-1', weight: 50, reps: 6 }, { id: 'live-set-2', weight: 52.5, reps: 6 }] }] }],
        }],
        fitnessWorkouts: [{
            id: 'workout-history-live',
            date: '2026-07-28',
            status: 'done',
            title: '上次胸部',
            planId: '',
            planName: '',
            durationMin: 45,
            exercises: [{ id: 'history-live-ex', name: '卧推建议', targetSets: 2, targetReps: '8', targetWeight: 55, restSec: 90, note: '', plannedSets: [], sets: [{ id: 'history-set-1', weight: 55, reps: 8, done: true }, { id: 'history-set-2', weight: 57.5, reps: 7, done: true }] }],
            createdAt: '2026-07-28T08:00:00',
            updatedAt: '2026-07-28T09:00:00',
        }],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'fitness-live-before' }));
    }, source);

    await page.goto('/#/fitness');
    await page.locator('article.card').filter({ hasText: '开始计划训练' }).locator('.fitness-metric-row').filter({ hasText: '实时训练计划' }).getByRole('button', { name: '按计划开练' }).click();
    const active = page.locator('#page-fitness > article.card').first();
    await expect(active).toContainText('上次 2026-07-28 57.5kg × 7');
    const firstRow = active.locator('.fitness-live-row').first();
    await expect(firstRow.locator('.vue-fitness-set-suggestion')).toContainText('2026-07-28 57.5kg × 7');
    await firstRow.getByRole('button', { name: '套用建议' }).click();

    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    const activeWorkout = stored.data.fitnessWorkouts.find(item => item.status === 'inProgress');
    expect(activeWorkout.exercises[0].sets[0]).toEqual(expect.objectContaining({ weight: 57.5, reps: 7, done: false }));
    expect(stored.syncState.dirty).toBe(true);

    await firstRow.getByRole('button', { name: '完成本组' }).click();
    await expect(active.getByRole('timer')).toContainText('卧推建议');
    await expect(active.getByRole('timer')).toContainText(/1:2\\d|1:30/);
    await expect(active.getByRole('button', { name: '+30s' })).toBeVisible();
    await expect(active.getByRole('button', { name: '-30s' })).toBeVisible();
    await active.getByRole('button', { name: '跳过' }).click();
    await expect(active.getByRole('timer')).toHaveCount(0);

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const afterDone = stored.fitnessWorkouts.find(item => item.status === 'inProgress');
    expect(afterDone.exercises[0].sets[0]).toEqual(expect.objectContaining({ weight: 57.5, reps: 7, done: true }));
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
    const today = localDate();
    await page.addInitScript(({ data, date }) => localStorage.setItem('lifePlanData', JSON.stringify({
        ...data,
        habits: [{ id: 'habit-1', name: '阅读', rule: 'daily', timesPerDay: '1', startDate: date, rewardPoints: 2, rewardCurrency: '金币' }],
    })), { data: emptyData(), date: today });
    await page.goto('/#/habits');
    await page.getByRole('button', { name: '打卡', exact: true }).click();
    await expect(page.locator('#page-habits')).toContainText('1/1 次');
    const stored = await page.evaluate(() => ({ data: JSON.parse(localStorage.getItem('lifePlanData')), mirror: JSON.parse(localStorage.getItem('habitAppData')) }));
    expect(stored.data.checkins).toHaveLength(1);
    expect(stored.data.checkins[0]).toMatchObject({ habitId: 'habit-1', date: today, note: '' });
    expect(stored.mirror.localMirror).toBe(true);
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
});

test('habit note backfill edit and undo keep local mirror and ledger contracts', async ({ page }) => {
    const dateAt = amount => {
        const date = new Date();
        date.setDate(date.getDate() + amount);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const today = dateAt(0);
    const yesterday = dateAt(-1);
    const source = emptyData({
        habits: [{
            id: 'habit-correction',
            name: '复盘习惯',
            rule: 'daily',
            timesPerDay: '2',
            startDate: '2026-07-01',
            rewardPoints: 3,
            rewardCurrency: '星星',
            noteMode: 'never',
            createdAt: '2026-07-01T08:00:00',
            updatedAt: '2026-07-01T08:00:00',
        }],
        habitPointLedger: [{
            id: 'ledger-miss',
            habitId: 'habit-correction',
            sourceId: `habit-correction:${yesterday}:miss`,
            date: yesterday,
            amount: -2,
            currency: '星星',
            type: 'miss',
            note: '未完成「复盘习惯」',
            createdAt: `${yesterday}T23:00:00`,
            updatedAt: `${yesterday}T23:00:00`,
        }],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'habit-before' }));
        localStorage.setItem('habitAppData', JSON.stringify({ localMirror: true, remoteUploadEnabled: true, mirror: { reason: 'stale' } }));
    }, source);

    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '补卡' }).click();
    const card = page.locator('.habit-quick-card').filter({ hasText: '复盘习惯' });
    const actionForm = card.locator('.habit-correction-form');
    await actionForm.locator('label').filter({ hasText: '日期' }).locator('input').fill(yesterday);
    await actionForm.locator('label').filter({ hasText: '备注' }).locator('input').fill('昨天补卡备注');
    await actionForm.getByRole('button', { name: '备注打卡/补卡' }).click();
    await expect(page.locator('.notice.success')).toContainText(`补卡 ${yesterday}`);

    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.checkins).toHaveLength(1);
    expect(stored.data.checkins[0]).toEqual(expect.objectContaining({ habitId: 'habit-correction', date: yesterday, note: '昨天补卡备注' }));
    expect(stored.data.habitPointLedger).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'checkin', sourceId: stored.data.checkins[0].id, amount: 3, currency: '星星' }),
        expect.objectContaining({ type: 'reverse-penalty', sourceId: `habit-correction:${yesterday}:penalty-reversal:星星`, amount: 2, currency: '星星' }),
    ]));
    expect(stored.mirror.localMirror).toBe(true);
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mirror.mirror.reason).toBe('append-checkin');
    expect(stored.syncState.dirty).toBe(true);

    await actionForm.locator('label').filter({ hasText: '日期' }).locator('input').fill(today);
    await actionForm.locator('label').filter({ hasText: '备注' }).locator('input').fill('今天初始备注');
    await actionForm.getByRole('button', { name: '备注打卡/补卡' }).click();
    await expect(page.locator('.notice.success')).toContainText('已为「复盘习惯」打卡');
    const todayRow = card.locator('.habit-checkin-note-row').last();
    await todayRow.locator('input').fill('今天编辑后的备注');
    await todayRow.getByRole('button', { name: '保存备注' }).click();
    await expect(page.locator('.notice.success')).toContainText('打卡备注已保存');

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const todayCheckin = stored.checkins.find(item => item.date === today);
    expect(todayCheckin.note).toBe('今天编辑后的备注');

    await actionForm.getByRole('button', { name: '撤销最近一次' }).click();
    stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.checkins.map(item => item.date)).toEqual([yesterday]);
    expect(stored.data.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'checkins', id: todayCheckin.id, reason: 'manual-decrease', habitId: 'habit-correction' }),
    ]));
    expect(stored.data.habitPointLedger).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'reverse', sourceId: todayCheckin.id, amount: -3, currency: '星星' }),
    ]));
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mirror.mirror.reason).toBe('decrease-checkin');
    expect(stored.syncState.dirty).toBe(true);
});

test('habit backfill list follows the selected date schedule', async ({ page }) => {
    const dateAt = amount => {
        const date = new Date();
        date.setDate(date.getDate() + amount);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const today = dateAt(0);
    const yesterday = dateAt(-1);
    const yesterdayWeekday = String(new Date(`${yesterday}T12:00:00`).getDay());
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData({
        habits: [{
            id: 'habit-backfill-schedule',
            name: '仅昨日执行',
            rule: 'weekly-fixed',
            weekdays: [yesterdayWeekday],
            timesPerDay: 1,
            startDate: dateAt(-30),
        }],
    }));

    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '补卡' }).click();
    const backfillDate = page.getByLabel('补卡日期');
    await expect(page.locator('.habit-quick-card').filter({ hasText: '仅昨日执行' })).toHaveCount(0);

    await backfillDate.fill(yesterday);
    const card = page.locator('.habit-quick-card').filter({ hasText: '仅昨日执行' });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('0/1 次');

    await backfillDate.fill(today);
    await expect(page.locator('.habit-quick-card').filter({ hasText: '仅昨日执行' })).toHaveCount(0);
});

test('habit action cards expose legacy rule reward timing and note metadata', async ({ page }) => {
    const today = localDate();
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData({
        habits: [{
            id: 'habit-card-metadata', name: '晨间阅读', rule: 'daily', timesPerDay: 2,
            rewardPoints: 5, rewardCurrency: '金币', penaltyPoints: 2, startDate: '2026-01-01',
        }],
        checkins: [{
            id: 'checkin-card-metadata', habitId: 'habit-card-metadata', date: today,
            time: '08:15', checkinAt: `${today}T08:15:00`, createdAt: `${today}T08:15:00`, note: '读完一章',
        }],
    }));

    await page.goto('/#/habits');
    const card = page.locator('.habit-quick-card').filter({ hasText: '晨间阅读' });
    await expect(card).toContainText('每天');
    await expect(card).toContainText('进行中 1/2');
    await expect(card).toContainText('08:15');
    await expect(card).toContainText('+5 金币');
    await expect(card).toContainText('漏打 -2');
    await expect(card).toContainText('备注：读完一章');
});

test('habit base edit and delete preserve legacy management contracts', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const source = emptyData({
        records: [
            { id: 'record-keep', type: '日记', title: '普通记录保留', content: '', startDate: today, endDate: today, todoIds: [], updatedAt: '2026-07-27T08:00:00' },
            { id: 'record-habit-shadow', type: '习惯打卡-旧分组', title: '旧习惯影子', content: '', startDate: today, endDate: today, isHabitRecord: true, habitId: 'habit-manage', todoIds: [], updatedAt: '2026-07-27T08:00:00' },
        ],
        habits: [{
            id: 'habit-manage',
            name: '旧习惯',
            rule: 'daily',
            weekdays: [],
            count: 3,
            timesPerDay: '1',
            tag: '旧分组',
            goalCount: 0,
            noteMode: 'ask',
            rewardPoints: 7,
            rewardCurrency: '星星',
            penaltyPoints: 2,
            penaltyCurrency: '星星',
            randomReward: false,
            rewardMin: 7,
            rewardMax: 7,
            breakPenaltyMode: 'fixed',
            breakPenaltyPoints: 1,
            breakPenaltyCurrency: '星星',
            startDate: today,
            createdAt: '2026-07-27T08:00:00',
            updatedAt: '2026-07-27T08:00:00',
        }],
        checkins: [{ id: 'checkin-manage', habitId: 'habit-manage', date: today, time: '07:00', checkinAt: `${today}T07:00:00`, note: '历史备注', createdAt: `${today}T07:00:00`, updatedAt: `${today}T07:00:00` }],
        habitPointLedger: [{ id: 'ledger-manage', habitId: 'habit-manage', sourceId: 'checkin-manage', date: today, amount: 7, currency: '星星', type: 'checkin', createdAt: `${today}T07:00:00`, updatedAt: `${today}T07:00:00` }],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'habit-manage-before' }));
        localStorage.setItem('habitAppData', JSON.stringify({ localMirror: true, remoteUploadEnabled: true, mirror: { reason: 'stale' } }));
    }, source);

    await page.goto('/#/habits?habit=habit-manage');
    const management = page.locator('.habit-management-card');
    await expect(management.getByRole('heading', { name: '编辑基础习惯' })).toBeVisible();
    await management.getByLabel('习惯名称').fill('更新习惯');
    await management.getByLabel('分组标签').fill('新分组');
    await management.getByLabel('规则').selectOption('weekly-count');
    await management.getByLabel('目标次数', { exact: true }).fill('4');
    await management.getByLabel('每天次数').fill('3');
    await management.getByLabel('总目标次数').fill('30');
    await management.getByLabel('备注模式').selectOption('never');
    await management.getByText('高级积分与里程碑').click();
    await management.getByLabel('固定奖励', { exact: true }).fill('9');
    await management.getByLabel('奖励币种', { exact: true }).fill('能量');
    await management.getByLabel('未完成扣分', { exact: true }).fill('4');
    await management.getByLabel('扣金币种', { exact: true }).fill('罚金币');
    await management.getByLabel('使用随机奖励区间', { exact: true }).check();
    await management.getByLabel('奖励下限', { exact: true }).fill('5');
    await management.getByLabel('奖励上限', { exact: true }).fill('12');
    await management.locator('label.form-field').filter({ hasText: '断签扣分' }).locator('select').selectOption('fixed');
    await management.getByLabel('断签扣分值', { exact: true }).fill('6');
    await management.getByLabel('断签币种', { exact: true }).fill('断签币');
    const milestoneRow = management.locator('.habit-milestone-row').filter({ hasText: '7 天' });
    await milestoneRow.getByRole('checkbox').check();
    await management.getByLabel('7 天奖励', { exact: true }).fill('20');
    await management.getByLabel('7 天奖励币种', { exact: true }).fill('里程碑币');
    await management.getByLabel('7 天罚款', { exact: true }).fill('3');
    await management.getByLabel('7 天罚款币种', { exact: true }).fill('里程碑罚币');
    await management.getByRole('button', { name: '保存习惯' }).click();
    await expect(page.locator('.notice.success')).toContainText('已保存「更新习惯」');

    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.habits).toHaveLength(1);
    expect(stored.data.habits[0]).toMatchObject({
        id: 'habit-manage',
        name: '更新习惯',
        rule: 'weekly-count',
        count: 4,
        timesPerDay: '3',
        tag: '新分组',
        goalCount: 30,
        noteMode: 'never',
        rewardPoints: 9,
        rewardCurrency: '能量',
        penaltyPoints: 4,
        penaltyCurrency: '罚金币',
        randomReward: true,
        rewardMin: 5,
        rewardMax: 12,
        breakPenaltyMode: 'fixed',
        breakPenaltyPoints: 6,
        breakPenaltyCurrency: '断签币',
        createdAt: '2026-07-27T08:00:00',
    });
    expect(stored.data.habits[0].milestoneRewards).toEqual(expect.arrayContaining([
        expect.objectContaining({ days: 7, enabled: true, rewardAmount: 20, currency: '里程碑币', penaltyAmount: 3, penaltyCurrency: '里程碑罚币' }),
    ]));
    expect(stored.data.habitCurrencies.map(item => item.name)).toEqual(expect.arrayContaining(['金币', '能量', '罚金币', '断签币', '里程碑币', '里程碑罚币']));
    expect(stored.data.habits[0].updatedAt).not.toBe('2026-07-27T08:00:00');
    expect(stored.data.records.map(item => item.id)).toEqual(['record-keep']);
    expect(stored.mirror.localMirror).toBe(true);
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mirror.mirror.reason).toBe('vue-update-habit');
    expect(stored.mirror.habits).toEqual(expect.arrayContaining([expect.objectContaining({ id: expect.stringContaining('habit-manage') })]));
    expect(stored.syncState.dirty).toBe(true);

    page.once('dialog', dialog => dialog.accept());
    await management.locator('.habit-library-row').filter({ hasText: '更新习惯' }).getByRole('button', { name: '删除' }).click();
    await expect(page.locator('.notice.success')).toContainText('已删除「更新习惯」');
    stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.habits).toHaveLength(0);
    expect(stored.data.checkins).toHaveLength(0);
    expect(stored.data.records.map(item => item.id)).toEqual(['record-keep']);
    expect(stored.data.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'habits', id: 'habit-manage', reason: 'manual-delete', name: '更新习惯' }),
        expect.objectContaining({ collection: 'checkins', id: 'checkin-manage', reason: 'habit-delete', habitId: 'habit-manage' }),
    ]));
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mirror.mirror.reason).toBe('vue-delete-habit');
    expect(stored.mirror.habits.some(item => String(item.id || '').includes('habit-manage'))).toBe(false);
    expect(stored.mirror.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'habits', id: expect.stringContaining('habit-manage') }),
        expect.objectContaining({ collection: 'habitRecords', id: expect.stringContaining('checkin-manage'), parentId: expect.stringContaining('habit-manage') }),
    ]));
    expect(stored.syncState.dirty).toBe(true);
});

test('habit library exposes legacy today streak and last operation summary', async ({ page }) => {
    const todayDate = new Date();
    todayDate.setHours(12, 0, 0, 0);
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const dayBeforeDate = new Date(todayDate);
    dayBeforeDate.setDate(dayBeforeDate.getDate() - 2);
    const today = localDate(todayDate);
    const yesterday = localDate(yesterdayDate);
    const dayBefore = localDate(dayBeforeDate);
    const source = emptyData({
        habits: [{ id: 'habit-library-summary', name: '连续阅读', tag: '成长', rule: 'daily', timesPerDay: 2, startDate: dayBefore }],
        checkins: [
            { id: 'library-before-one', habitId: 'habit-library-summary', date: dayBefore, time: '08:00', checkinAt: `${dayBefore}T08:00:00`, createdAt: `${dayBefore}T08:00:00` },
            { id: 'library-yesterday-one', habitId: 'habit-library-summary', date: yesterday, time: '08:00', checkinAt: `${yesterday}T08:00:00`, createdAt: `${yesterday}T08:00:00` },
            { id: 'library-yesterday-two', habitId: 'habit-library-summary', date: yesterday, time: '09:00', checkinAt: `${yesterday}T09:00:00`, createdAt: `${yesterday}T09:00:00` },
            { id: 'library-today-one', habitId: 'habit-library-summary', date: today, time: '08:30', checkinAt: `${today}T08:30:00`, createdAt: `${today}T08:30:00` },
            { id: 'library-today-two', habitId: 'habit-library-summary', date: today, time: '09:45', checkinAt: `${today}T09:45:00`, createdAt: `${today}T09:45:00` },
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);

    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '习惯库' }).click();
    const table = page.locator('.habit-management-table');
    await expect(table.locator('.habit-library-row.head')).toContainText('今日');
    await expect(table.locator('.habit-library-row.head')).toContainText('连续');
    await expect(table.locator('.habit-library-row.head')).toContainText('最后操作');
    const row = table.locator('.habit-library-row').filter({ hasText: '连续阅读' });
    await expect(row).toContainText('成长');
    await expect(row).toContainText('每天 · 2次/天');
    await expect(row).toContainText('2/2');
    await expect(row).toContainText('2 天');
    await expect(row).toContainText(`${todayDate.getFullYear()}年${todayDate.getMonth() + 1}月${todayDate.getDate()}日 09:45:00`);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('habit today empty state keeps the legacy wording', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/habits');
    await expect(page.locator('#page-habits .habit-quick-list')).toContainText('今日暂无安排的习惯');
});

test('habit library empty state keeps the legacy wording', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '习惯库' }).click();
    await expect(page.locator('.habit-management-table')).toContainText('暂无习惯，先新建一个习惯。');
});

test('habit analysis matrix empty state keeps the legacy wording', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '分析' }).click();
    await expect(page.locator('.habit-matrix-block')).toContainText('暂无习惯，先新建一个习惯');
});

test('habit analysis matrix keeps archived history rows', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const source = emptyData({
        habits: [{ id: 'habit-archived-matrix', name: '归档历史矩阵习惯', rule: 'daily', timesPerDay: '1', startDate: '2026-01-01', archived: true }],
        checkins: [{ id: 'checkin-archived-matrix', habitId: 'habit-archived-matrix', date: today, time: '08:00', checkinAt: `${today}T08:00:00`, note: '保留分析历史' }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/habits');

    await expect(page.locator('.habit-quick-list')).not.toContainText('归档历史矩阵习惯');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '分析' }).click();
    await expect(page.locator('.habit-matrix-grid')).toContainText('归档历史矩阵习惯');
    await expect(page.locator('.habit-analysis-summary')).toContainText('归档历史矩阵习惯');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('habit archive and restore preserve history without tombstones', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const source = emptyData({
        habits: [{ id: 'habit-archive', name: '归档习惯', rule: 'daily', timesPerDay: '1', startDate: today, rewardPoints: 2, rewardCurrency: '金币', createdAt: '2026-07-27T08:00:00', updatedAt: '2026-07-27T08:00:00' }],
        checkins: [{ id: 'checkin-archive', habitId: 'habit-archive', date: today, time: '07:00', checkinAt: `${today}T07:00:00`, note: '历史保留', createdAt: `${today}T07:00:00`, updatedAt: `${today}T07:00:00` }],
        habitPointLedger: [{ id: 'ledger-archive', habitId: 'habit-archive', sourceId: 'checkin-archive', date: today, amount: 2, currency: '金币', type: 'checkin', createdAt: `${today}T07:00:00`, updatedAt: `${today}T07:00:00` }],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'habit-archive-before' }));
    }, source);

    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '习惯库' }).click();
    await expect(page.locator('.habit-quick-card').filter({ hasText: '归档习惯' })).toHaveCount(1);
    const row = page.locator('.habit-management-card .habit-library-row').filter({ hasText: '归档习惯' });
    page.once('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: '归档' }).click();
    await expect(page.locator('.notice.success')).toContainText('已归档「归档习惯」');
    await expect(page.locator('.habit-quick-card').filter({ hasText: '归档习惯' })).toHaveCount(0);

    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.habits[0]).toMatchObject({ id: 'habit-archive', archived: true });
    expect(stored.data.checkins).toHaveLength(1);
    expect(stored.data.habitPointLedger).toHaveLength(1);
    expect(stored.data.deletedItems).toEqual([]);
    expect(stored.mirror.habits).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'archived' })]));
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mirror.mirror.reason).toBe('vue-archive-habit');
    expect(stored.syncState.dirty).toBe(true);

    await row.getByRole('button', { name: '恢复' }).click();
    await expect(page.locator('.notice.success')).toContainText('已恢复「归档习惯」');
    await expect(page.locator('.habit-quick-card').filter({ hasText: '归档习惯' })).toHaveCount(1);
    stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
    }));
    expect(stored.data.habits[0].archived).toBe(false);
    expect(stored.data.deletedItems).toEqual([]);
    expect(stored.mirror.habits).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'active' })]));
});

test('habit wishes create and archive preserve reward mirror contract', async ({ page }) => {
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'habit-reward-before' }));
    }, emptyData());

    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '钱包' }).click();
    const wallet = page.locator('.habit-wallet-panel');
    await expect(wallet.locator('.habit-reward-list')).toContainText('还没有心愿，先添加一个能让你真的想兑换的奖励');
    await expect(wallet.locator('.habit-ledger-panel')).toContainText('暂无积分流水');
    await wallet.getByLabel('心愿名称').fill('买一本好书');
    await wallet.getByLabel('花费').fill('12');
    await wallet.getByLabel('币种').fill('钻石');
    await wallet.getByLabel('库存').fill('3');
    await wallet.getByLabel('备注').fill('完成一周后兑换');
    await wallet.getByRole('button', { name: '新增心愿' }).click();
    await expect(page.locator('.notice.success')).toContainText('已添加心愿「买一本好书」');
    await wallet.locator('.habit-reward-card').filter({ hasText: '买一本好书' }).getByRole('button', { name: '归档心愿' }).click();
    await expect(page.locator('.notice.success')).toContainText('已归档心愿「买一本好书」');

    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.habitRewards).toHaveLength(1);
    expect(stored.data.habitRewards[0]).toMatchObject({ name: '买一本好书', cost: 12, currency: '钻石', stock: 3, redeemedCount: 0, note: '完成一周后兑换', archived: true });
    expect(stored.data.habitCurrencies.map(item => item.name)).toEqual(expect.arrayContaining(['钻石']));
    expect(stored.data.deletedItems).toEqual([]);
    expect(stored.mirror.habitRewards).toEqual(expect.arrayContaining([expect.objectContaining({ name: '买一本好书', cost: 12, status: 'archived' })]));
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mirror.mirror.reason).toBe('vue-archive-habit-reward');
    expect(stored.syncState.dirty).toBe(true);
});

test('habit wallet redeem deducts points and blocks unavailable wishes', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const source = emptyData({
        habitPointLedger: [{ id: 'ledger-earned', amount: 12, currency: '星星', type: 'manual_reward', date: today, note: '初始奖励', createdAt: `${today}T08:00:00`, updatedAt: `${today}T08:00:00` }],
        habitRewards: [
            { id: 'reward-buy', name: '小奖励', cost: 5, currency: '星星', stock: 1, redeemedCount: 0, note: '可兑换', createdAt: `${today}T08:00:00`, updatedAt: `${today}T08:00:00` },
            { id: 'reward-expensive', name: '大愿望', cost: 99, currency: '星星', stock: 0, redeemedCount: 0, createdAt: `${today}T08:00:00`, updatedAt: `${today}T08:00:00` },
            { id: 'reward-empty', name: '售罄愿望', cost: 1, currency: '星星', stock: 1, redeemedCount: 1, createdAt: `${today}T08:00:00`, updatedAt: `${today}T08:00:00` },
        ],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'habit-wallet-before' }));
    }, source);

    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '钱包' }).click();
    const wallet = page.locator('.habit-wallet-panel');
    await expect(wallet.locator('.habit-wallet-stats')).toContainText('累计获得 12 星星');
    await expect(wallet.locator('.habit-wallet-stats')).toContainText('已兑换 0 金币');
    await expect(wallet.locator('.habit-reward-card').filter({ hasText: '大愿望' }).getByRole('button', { name: '兑换' })).toBeDisabled();
    await expect(wallet.locator('.habit-reward-card').filter({ hasText: '售罄愿望' }).getByRole('button', { name: '兑换' })).toBeDisabled();
    page.once('dialog', dialog => dialog.accept());
    await wallet.locator('.habit-reward-card').filter({ hasText: '小奖励' }).getByRole('button', { name: '兑换' }).click();
    await expect(page.locator('.notice.success')).toContainText('已兑换「小奖励」');
    await expect(wallet.locator('.habit-reward-card').filter({ hasText: '小奖励' }).getByRole('button', { name: '兑换' })).toBeDisabled();
    await expect(wallet.locator('.habit-wallet-stats')).toContainText('已兑换 5 星星');

    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    expect(stored.data.habitRewards.find(item => item.id === 'reward-buy').redeemedCount).toBe(1);
    expect(stored.data.habitPointLedger).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'redeem', amount: -5, rewardId: 'reward-buy', currency: '星星', note: '兑换「小奖励」' }),
    ]));
    expect(stored.data.habitPointLedger.filter(item => item.type === 'redeem')).toHaveLength(1);
    expect(stored.mirror.habitLedger).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'reward_redeem', amount: -5 })]));
    expect(stored.mirror.habitRewardRecords).toHaveLength(1);
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mirror.mirror.reason).toBe('vue-redeem-habit-reward');
    expect(stored.syncState.dirty).toBe(true);
});

test('habit diagnostics stays read-only and surfaces legacy issues', async ({ page }) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const source = emptyData({
        habits: [
            { id: 'habit-duplicate', name: '重复习惯 A', rule: 'daily', timesPerDay: '1', startDate: '2026-07-01' },
            { id: 'habit-duplicate', name: '重复习惯 B', rule: 'daily', timesPerDay: '1', startDate: '2026-07-01' },
        ],
        checkins: [
            { id: 'checkin-orphan', habitId: 'missing-habit', date: '2026-07-29', time: '08:00', checkinAt: '2026-07-29T08:00:00' },
            { id: 'checkin-future', habitId: 'habit-duplicate', date: tomorrow, time: '08:00', checkinAt: `${tomorrow}T08:00:00` },
        ],
        habitPointLedger: [{ id: 'ledger-invalid', amount: 'not-a-number', currency: '', type: 'adjust', date: '2026-07-29' }],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        window.__habitBefore = localStorage.getItem('lifePlanData');
    }, source);

    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '分析' }).click();
    const diagnostics = page.locator('.habit-diagnostics-panel');
    await expect(diagnostics).toContainText('只读');
    await expect(diagnostics).toContainText('重复习惯 ID');
    await expect(diagnostics).toContainText('孤儿打卡记录');
    await expect(diagnostics).toContainText('流水金额异常');
    const readiness = diagnostics.locator('.habit-diagnostics-details');
    await readiness.locator('summary').click();
    await expect(readiness).toContainText('双写状态');
    await expect(readiness).toContainText('被高风险数据阻塞');
    await expect(readiness).toContainText('11 / 11');
    await expect(readiness).toContainText('本地双写路径');
    const unchanged = await page.evaluate(() => ({
        sameData: window.__habitBefore === localStorage.getItem('lifePlanData'),
        mirror: localStorage.getItem('habitAppData'),
    }));
    expect(unchanged.sameData).toBe(true);
    expect(unchanged.mirror).toBeNull();
});

test('habit analysis summary reports per-habit window stats without writes', async ({ page }) => {
    const dateAt = amount => {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + amount);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const today = dateAt(0);
    const yesterday = dateAt(-1);
    const source = emptyData({
        habits: [
            { id: 'habit-summary-a', name: '阅读统计', rule: 'daily', timesPerDay: '1', startDate: dateAt(-30) },
            { id: 'habit-summary-b', name: '拉伸统计', rule: 'daily', timesPerDay: '1', startDate: dateAt(-30) },
        ],
        checkins: [
            { id: 'checkin-summary-a-1', habitId: 'habit-summary-a', date: yesterday, time: '08:00', checkinAt: `${yesterday}T08:00:00` },
            { id: 'checkin-summary-a-2', habitId: 'habit-summary-a', date: today, time: '08:00', checkinAt: `${today}T08:00:00` },
            { id: 'checkin-summary-b-1', habitId: 'habit-summary-b', date: today, time: '09:00', checkinAt: `${today}T09:00:00` },
        ],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        window.__habitBefore = localStorage.getItem('lifePlanData');
    }, source);

    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '分析' }).click();
    const summary = page.locator('.habit-analysis-summary');
    await expect(summary).toBeVisible();
    await expect(summary.locator('.habit-analysis-summary-card')).toHaveCount(2);
    await expect(summary.locator('.habit-analysis-summary-card').filter({ hasText: '阅读统计' })).toContainText(/2\s*次打卡/);
    await expect(summary.locator('.habit-analysis-summary-card').filter({ hasText: '阅读统计' })).toContainText('连续有打卡 2 天');
    const unchanged = await page.evaluate(() => ({
        sameData: window.__habitBefore === localStorage.getItem('lifePlanData'),
        mirror: localStorage.getItem('habitAppData'),
    }));
    expect(unchanged.sameData).toBe(true);
    expect(unchanged.mirror).toBeNull();
});

test('habit annual analysis renders a read-only selected habit heatmap', async ({ page }) => {
    const dateAt = amount => {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + amount);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const today = dateAt(0);
    const yesterday = dateAt(-1);
    const source = emptyData({
        habits: [
            { id: 'habit-annual-a', name: '年度阅读', rule: 'daily', timesPerDay: '1', startDate: dateAt(-90) },
            { id: 'habit-annual-b', name: '年度拉伸', rule: 'daily', timesPerDay: '1', startDate: dateAt(-90) },
        ],
        checkins: [
            { id: 'checkin-annual-a-1', habitId: 'habit-annual-a', date: yesterday, time: '08:00' },
            { id: 'checkin-annual-a-2', habitId: 'habit-annual-a', date: today, time: '08:00' },
        ],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        window.__habitBefore = localStorage.getItem('lifePlanData');
    }, source);

    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '分析' }).click();
    const annual = page.locator('.habit-annual-analysis');
    await expect(annual).toBeVisible();
    await expect(annual).toContainText('年度阅读');
    expect(await annual.locator('.habit-annual-cell').count()).toBeGreaterThan(300);
    await expect(annual.locator('.habit-annual-months span')).toHaveCount(12);
    await expect(annual.locator('.habit-annual-stats')).toContainText('当前连续天数');
    await expect(annual.locator('.habit-annual-stats')).toContainText('本月完成率');
    await expect(annual.locator('.habit-history-panel')).toContainText('最近打卡备注');
    await expect(annual.locator('.habit-history-item')).toHaveCount(2);
    expect(await annual.evaluate(node => node.getBoundingClientRect().top)).toBeLessThan(await page.locator('.habit-matrix-block').evaluate(node => node.getBoundingClientRect().top));
    await expect(annual.locator('.habit-annual-habit-pill')).toHaveCount(2);
    await annual.locator('.habit-annual-habit-pill').filter({ hasText: '年度拉伸' }).click();
    await expect(annual).toContainText('年度拉伸');
    await annual.getByLabel('选择分析习惯').selectOption('habit-annual-b');
    await expect(annual).toContainText('年度拉伸');
    const unchanged = await page.evaluate(() => ({
        sameData: window.__habitBefore === localStorage.getItem('lifePlanData'),
        mirror: localStorage.getItem('habitAppData'),
    }));
    expect(unchanged.sameData).toBe(true);
    expect(unchanged.mirror).toBeNull();
});

test('habit penalty settle writes miss ledger once and keeps local mirror upload disabled', async ({ page }) => {
    const dateAt = amount => {
        const date = new Date();
        date.setDate(date.getDate() + amount);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const today = dateAt(0);
    const yesterday = dateAt(-1);
    const twoDaysAgo = dateAt(-2);
    const source = emptyData({
        habits: [{
            id: 'habit-settle',
            name: '结算扣分习惯',
            rule: 'daily',
            timesPerDay: '1',
            startDate: twoDaysAgo,
            rewardPoints: 0,
            rewardCurrency: '金币',
            penaltyPoints: 5,
            penaltyCurrency: '金币',
            breakPenaltyMode: 'none',
            createdAt: `${twoDaysAgo}T08:00:00`,
            updatedAt: `${twoDaysAgo}T08:00:00`,
        }],
        checkins: [],
        habitPointLedger: [],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'habit-settle-before' }));
    }, source);

    await page.goto('/#/habits');
    await page.locator('.habit-center-tabs').getByRole('tab', { name: '分析' }).click();
    const diagnostics = page.locator('.habit-diagnostics-panel');
    await diagnostics.getByRole('button', { name: '结算昨日扣分' }).click();
    await expect(page.locator('.notice.success')).toContainText('已结算扣分');

    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
        syncState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    const missEntries = stored.data.habitPointLedger.filter(item => item.type === 'miss' && item.habitId === 'habit-settle');
    expect(missEntries).toEqual(expect.arrayContaining([
        expect.objectContaining({
            type: 'miss',
            amount: -5,
            currency: '金币',
            habitId: 'habit-settle',
            sourceId: `habit-settle:${twoDaysAgo}:miss`,
            date: twoDaysAgo,
            note: '未完成「结算扣分习惯」',
        }),
        expect.objectContaining({
            type: 'miss',
            amount: -5,
            currency: '金币',
            habitId: 'habit-settle',
            sourceId: `habit-settle:${yesterday}:miss`,
            date: yesterday,
            note: '未完成「结算扣分习惯」',
        }),
    ]));
    expect(missEntries).toHaveLength(2);
    expect(missEntries.some(item => item.date === today)).toBe(false);
    expect(stored.syncState.dirty).toBe(true);
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mirror.mirror.reason).toBe('vue-settle-penalties');

    await diagnostics.getByRole('button', { name: '结算昨日扣分' }).click();
    await expect(page.locator('.notice.success')).toContainText('没有新的扣分');
    stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
    }));
    expect(stored.data.habitPointLedger.filter(item => item.type === 'miss' && item.habitId === 'habit-settle')).toHaveLength(2);
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
});

test('records day view maintains a fixed-width timed event with a complete hover title', async ({ page }) => {
    const today = localDate();
    await page.addInitScript(({ data, date }) => localStorage.setItem('lifePlanData', JSON.stringify({ ...data, records: [{ id: 'record-1', type: '日记', title: '这是一个完整的日程标题', content: '', startDate: date, endDate: date, recordTime: '09:00', recordEndTime: '10:00' }] })), { data: emptyData(), date: today });
    await page.goto('/#/records');
    await page.getByRole('button', { name: '日视图', exact: true }).click();
    const event = page.locator('.agenda-day-column .agenda-event-block').first();
    await expect(event).toHaveAttribute('title', /09:00 - 10:00 这是一个完整的日程标题/);
    await expect(event).toHaveCSS('width', '160px');
});

test('records fall back to legacy stored timestamps when recordTime is missing', async ({ page }) => {
    const today = localDate();
    const source = emptyData({
        records: [
            { id: 'record-created-time', type: '工作记录', title: '创建时间回退记录', content: '', startDate: today, endDate: today, createdAt: `${today}T10:30:00`, updatedAt: `${today}T12:00:00`, todoIds: [] },
            { id: 'record-updated-time', type: '日记', title: '更新时间回退记录', content: '', startDate: today, endDate: today, updatedAt: `${today}T11:45:00`, todoIds: [] },
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);

    await page.goto('/#/records');
    const rows = page.locator('#all-records .record-row');
    const createdRow = rows.filter({ hasText: '创建时间回退记录' });
    const updatedRow = rows.filter({ hasText: '更新时间回退记录' });
    await expect(createdRow.locator('.record-time')).toHaveText('10:30');
    await expect(updatedRow.locator('.record-time')).toHaveText('11:45');
    await expect(createdRow.locator('.record-time')).not.toHaveText('全天');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('records list and editor expose a frozen legacy-style read-only preview', async ({ page }) => {
    const today = localDate();
    const source = emptyData({
        records: [{
            id: 'record-preview-mode', type: '日记', title: '预览记录', content: '原始内容',
            startDate: today, endDate: today, todoIds: [], createdAt: `${today}T08:00:00`, updatedAt: `${today}T08:00:00`,
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/records');

    const row = page.locator('.record-row').filter({ hasText: '预览记录' });
    await row.locator('.record-open-button').click();
    const preview = page.getByRole('dialog', { name: '记录预览' });
    await expect(preview).toContainText('预览记录');
    await expect(preview).toContainText('原始内容');
    await expect(page.locator('.record-editor-panel')).toHaveCount(0);
    await preview.getByRole('button', { name: '编辑', exact: true }).click();

    const editor = page.locator('.record-editor-panel');
    await editor.getByLabel('标题').fill('尚未保存标题');
    await editor.getByRole('button', { name: '预览', exact: true }).click();
    await expect(preview).toContainText('尚未保存标题');
    await expect(preview).toContainText('当前预览，尚未保存');
    await expect(preview.getByRole('button', { name: '返回继续编辑' })).toBeVisible();
    await expect(preview.getByLabel('标题')).toHaveCount(0);
    await preview.getByRole('button', { name: '返回继续编辑' }).click();
    await expect(editor.getByLabel('标题')).toHaveValue('尚未保存标题');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('records empty state distinguishes no filters from filtered no-match results', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/records');
    const recordsPage = page.locator('#page-records');
    const results = page.locator('#all-records');

    await expect(results).toHaveText('暂无记录');
    await recordsPage.getByLabel('搜索记录').fill('不存在的记录');
    await expect(results).toHaveText('没有匹配的记录，换个关键词试试');
    await recordsPage.getByLabel('搜索记录').fill('');
    await recordsPage.getByLabel('记录类型筛选').selectOption('日记');
    await expect(results).toHaveText('没有匹配的记录，换个关键词试试');
    await recordsPage.getByLabel('记录类型筛选').selectOption('all');
    await expect(results).toHaveText('暂无记录');
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
    await expect(recordsPage.locator('#record-view-title')).toHaveText('全部记录');
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
    await expect(todayGroup.locator('.timeline-date')).toHaveText(/^\d{4}年\d{1,2}月\d{1,2}日$/);
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
    await expect(recordsPage.locator('#record-view-title')).toHaveText('全部历史');
    await expect(results).toContainText('历史范围外记录');
    await expect(results).toContainText('未来范围外记录');
    await expect(results).toContainText('未设置日期记录');

    await recordsPage.getByRole('button', { name: '日视图', exact: true }).click();
    await expect(recordsPage.getByLabel('记录日期范围')).toHaveCount(0);
    await expect(results).toContainText('执行：迁移执行事项');
    await expect(results).toContainText('聚合阅读习惯');
    await recordsPage.getByLabel('记录类型筛选').selectOption('待办');
    await expect(results).toContainText('计划：迁移执行事项');
    await expect(results).toContainText('截止：迁移执行事项');
    await expect(results).toContainText('执行：迁移执行事项');

    const storageAfter = await page.evaluate(() => ({
        lifePlanData: localStorage.getItem('lifePlanData'),
        todoMirror: JSON.parse(localStorage.getItem('todoAppData')),
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
    await expect(list.locator('.material-card').filter({ hasText: '较新方法素材' })).toContainText('2026年7月26日 08:00:00');

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
    await expectHashRoute(page, '/materials');
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

test('materials direct editor open and close keep URL unchanged', async ({ page }) => {
    const source = emptyData({
        materials: [{ id: 'material-direct-editor', type: '摘抄', content: '直接编辑素材', tags: ['阅读'], source: '旧书', note: '只读检查' }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/materials');
    const materialsPage = page.locator('#page-materials');
    await materialsPage.getByRole('button', { name: '编辑素材 直接编辑素材' }).click();
    await expectHashRoute(page, '/materials');
    const editor = materialsPage.getByRole('dialog', { name: '编辑素材' });
    await expect(editor.getByLabel('内容')).toHaveValue('直接编辑素材');
    await editor.getByRole('button', { name: '关闭素材编辑' }).click();
    await expectHashRoute(page, '/materials');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
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

test('materials tag navigation clears stale keyword and type filters', async ({ page }) => {
    const source = emptyData({
        materials: [
            { id: 'material-tag-beta', type: '方法', content: 'Beta 标签素材', tags: ['Beta'], source: '', note: '' },
            { id: 'material-tag-alpha', type: '摘抄', content: 'Alpha 标签素材', tags: ['Alpha'], source: '', note: '' },
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/materials');
    const materialsPage = page.locator('#page-materials');
    const list = materialsPage.locator('.material-list');
    await materialsPage.getByLabel('搜索素材').fill('Alpha');
    await materialsPage.getByLabel('素材类型筛选').selectOption('方法');
    await expect(list).toContainText('暂无匹配素材');

    await page.goto('/#/materials?tag=Beta');
    await expect(materialsPage.getByLabel('素材标签筛选')).toHaveValue('Beta');
    await expect(materialsPage.getByLabel('搜索素材')).toHaveValue('');
    await expect(materialsPage.getByLabel('素材类型筛选')).toHaveValue('all');
    await expect(list).toContainText('Beta 标签素材');
    await expect(list).not.toContainText('Alpha 标签素材');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('search does not match a todo only through its localized module label', async ({ page }) => {
    const source = emptyData({
        todos: [todoFixture('todo-label-only', '整理周报', { note: '汇总本周工作', group: '工作' })],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);

    await page.goto('/#/search?q=待办');
    await expect(page.locator('.search-result-item')).toHaveCount(0);
    await expect(page.locator('.empty-state')).toHaveText('没有找到匹配内容');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('record editor keeps an old custom type as a controlled option', async ({ page }) => {
    const source = emptyData({
        records: [{ id: 'record-legacy-type', type: '旧自定义类型', title: '旧类型记录', content: '兼容旧数据', startDate: localDate(), endDate: localDate(), todoIds: [] }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/records?record=record-legacy-type');
    const typeSelect = page.locator('.record-editor-panel').getByLabel('类型');
    await expect(typeSelect).toHaveValue('旧自定义类型');
    await expect(typeSelect.locator('option', { hasText: '旧自定义类型（旧类型）' })).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
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
    await page.getByRole('dialog', { name: '记录预览' }).getByRole('button', { name: '编辑', exact: true }).click();
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

test('record linked todo checkbox toggles the authoritative todo without changing the link', async ({ page }) => {
    const source = emptyData({
        records: [{ id: 'record-toggle-linked', type: '日记', title: '可勾选关联记录', content: '', startDate: '2026-07-28', endDate: '2026-07-28', todoIds: ['todo-toggle-linked'] }],
        todos: [{ id: 'todo-toggle-linked', text: '关联完成项', note: '', done: false, dueDate: '', planStartDate: '', planEndDate: '', urgency: 'medium', group: '其他', subTodos: [], sessions: [], completedAt: '', sourceType: 'manual', sourceRecordId: '', sourceMatchKey: '关联完成项' }],
    });
    const originalTodoIds = source.records[0].todoIds;
    await page.addInitScript(data => {
        if (!localStorage.getItem('lifePlanData')) localStorage.setItem('lifePlanData', JSON.stringify(data));
    }, source);
    await page.goto('/#/records?record=record-toggle-linked');
    const editor = page.locator('.record-editor-panel');
    const checkbox = editor.getByRole('checkbox', { name: '完成 关联完成项' });
    await checkbox.check();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).todos.find(todo => todo.id === 'todo-toggle-linked').done)).toBe(true);
    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    expect(stored.data.records.find(record => record.id === 'record-toggle-linked').todoIds).toEqual(originalTodoIds);
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.mirror.todos.find(todo => todo.id === 'todo-toggle-linked').done).toBe(true);

    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).todos.find(todo => todo.id === 'todo-toggle-linked').done)).toBe(true);
    await expect(editor.getByRole('checkbox', { name: '完成 关联完成项' })).toBeChecked();
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
    await page.getByRole('dialog', { name: '记录预览' }).getByRole('button', { name: '编辑', exact: true }).click();
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

test('records header template manager opens without an active record', async ({ page }) => {
    const source = emptyData({
        templates: [{ id: 'template-header', name: '页头复盘模板', type: '日记', content: '## 复盘\n' }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);

    await page.goto('/#/records');
    await page.getByRole('button', { name: /模板管理/ }).click();

    const manager = page.getByRole('dialog', { name: '模板管理' });
    await expect(manager).toBeVisible();
    await expect(manager).toContainText('页头复盘模板');
    await expect(manager.getByRole('button', { name: '删除模板 页头复盘模板' })).toBeVisible();
    await manager.getByRole('button', { name: '关闭模板管理' }).click();
    await expect(manager).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('records empty template manager explains built-in templates', async ({ page }) => {
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), emptyData());
    await page.goto('/#/records');
    await page.getByRole('button', { name: /模板管理/ }).click();
    await expect(page.getByRole('dialog', { name: '模板管理' })).toContainText('暂无自定义模板。内置模板会直接出现在对应记录类型的模板下拉里。');
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
    await page.getByRole('dialog', { name: '记录预览' }).getByRole('button', { name: '编辑', exact: true }).click();
    page.once('dialog', dialog => dialog.accept('工作推进模板'));
    await page.locator('.record-editor-panel').getByRole('button', { name: '保存为模板' }).click();
    const templateId = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).templates[0].id);

    await page.locator('.record-editor-panel').getByRole('button', { name: '关闭' }).click();
    await page.getByRole('button', { name: /模板目标/ }).first().click();
    await page.getByRole('dialog', { name: '记录预览' }).getByRole('button', { name: '编辑', exact: true }).click();
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
    const recordType = editor.getByLabel('类型');
    await expect(recordType.locator('option')).toHaveCount(12);
    await recordType.selectOption('日记');
    await editor.getByRole('button', { name: '保存修改' }).click();
    const converted = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records.find(item => item.id === 'idea-needs-conclusion'));
    expect(converted).toMatchObject({
        type: '日记', ideaStatus: '', ideaTags: [], ideaNextAction: '', ideaTodoId: '', ideaConclusion: '',
    });
});

test('ideas cards keep legacy compact fields only', async ({ page }) => {
    const source = emptyData({
        records: [{
            id: 'idea-card-fields', type: '灵感碎片', title: '卡片字段灵感', content: '灵感卡片正文',
            startDate: '2026-07-30', endDate: '2026-07-30', ideaStatus: '实践中', ideaTags: [],
            ideaNextAction: '卡片不展示的下一步', ideaConclusion: '卡片不展示的结论', todoIds: [],
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(value => localStorage.setItem('lifePlanData', value), original);
    await page.goto('/#/ideas');

    const card = page.locator('.idea-card').filter({ hasText: '卡片字段灵感' });
    await expect(card).toContainText('灵感卡片正文');
    await expect(card).not.toContainText('卡片不展示的下一步');
    await expect(card).not.toContainText('卡片不展示的结论');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('idea view opens a read-only record preview before editing', async ({ page }) => {
    const source = emptyData({
        records: [{
            id: 'idea-view-preview', type: '灵感碎片', title: '只读查看灵感', content: '先看清楚再决定推进。',
            startDate: '2026-07-30', endDate: '2026-07-30', todoIds: [], ideaStatus: '实践中', ideaTags: ['验证'],
            ideaNextAction: '做一个小实验', ideaTodoId: '', ideaConclusion: '',
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/ideas');
    await page.locator('.idea-card').filter({ hasText: '只读查看灵感' }).getByRole('button', { name: '查看', exact: true }).click();
    await expectHashRoute(page, '/records', { record: 'idea-view-preview', preview: '1' });
    const preview = page.getByRole('dialog', { name: '记录预览' });
    await expect(preview).toContainText('只读查看灵感');
    await expect(preview).toContainText('先看清楚再决定推进。');
    await expect(page.locator('.record-editor-panel')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);

    await preview.getByRole('button', { name: '编辑', exact: true }).click();
    await expect(page.locator('.record-editor-panel')).toBeVisible();
    await expectHashRoute(page, '/records', { record: 'idea-view-preview' });
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('ideas keep legacy creation and record-time ordering', async ({ page }) => {
    const source = emptyData({
        records: [
            { id: 'idea-old-updated', type: '灵感碎片', title: '旧创建后更新灵感', content: '旧创建时间应决定排序', startDate: '2026-07-01', endDate: '2026-07-01', createdAt: '2026-07-01T08:00:00', updatedAt: '2026-07-30T08:00:00', ideaStatus: '实践中', ideaTags: [], ideaConclusion: '已记录', todoIds: [] },
            { id: 'idea-new-created', type: '灵感碎片', title: '新创建灵感', content: '新创建时间', startDate: '2026-07-20', endDate: '2026-07-20', createdAt: '2026-07-20T08:00:00', updatedAt: '2026-07-20T08:00:00', ideaStatus: '实践中', ideaTags: [], ideaConclusion: '已记录', todoIds: [] },
            { id: 'idea-record-time', type: '灵感碎片', title: '记录时间灵感', content: '记录时间参与排序', startDate: '2026-07-25', endDate: '2026-07-25', recordTime: '07:30', createdAt: '2026-07-24T08:00:00', updatedAt: '2026-07-26T08:00:00', ideaStatus: '实践中', ideaTags: [], ideaConclusion: '已记录', todoIds: [] },
        ],
    });
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/ideas');

    const titles = await page.locator('.idea-card h3').allTextContents();
    expect(titles).toEqual(['记录时间灵感', '新创建灵感', '旧创建后更新灵感']);
});

test('idea conversion opens an editable pre-create draft then links only after save', async ({ page }) => {
    const source = emptyData({
        records: [{
            id: 'idea-convert', type: '灵感碎片', title: '把灵感变成行动', content: '记录转换背景',
            startDate: '2026-07-27', endDate: '2026-07-27', todoIds: [], ideaStatus: '待整理',
            ideaTags: ['行动'], ideaNextAction: '先做最小验证实验', ideaTodoId: 'missing-todo', ideaConclusion: '', updatedAt: '2026-07-27T08:00:00',
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/ideas');
    await page.locator('.idea-card').filter({ hasText: '把灵感变成行动' }).getByRole('button', { name: '转成待办' }).click();
    await expectHashRoute(page, '/todos', { ideaDraft: 'idea-convert' });
    const detail = page.locator('.todo-detail-panel');
    await expect(detail.getByRole('heading', { name: '灵感转待办' })).toBeVisible();
    await expect(detail).toContainText('来源灵感：把灵感变成行动');
    await expect(detail.getByLabel('任务', { exact: true })).toHaveValue('先做最小验证实验');
    await expect(detail.getByLabel('分组')).toHaveValue('学习');
    await expect(detail.getByLabel('备注')).toHaveValue(/来源灵感：把灵感变成行动/);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('todoAppData'))).toBeNull();

    await detail.getByLabel('任务', { exact: true }).fill('编辑后的灵感待办');
    await detail.getByLabel('备注').fill('用户确认后的备注');
    await detail.getByLabel('截止日期').fill('2026-07-31');
    await detail.getByLabel('新子任务').fill('准备材料');
    await detail.getByRole('button', { name: '添加', exact: true }).click();
    await detail.getByRole('button', { name: '创建并关联灵感' }).click();

    await expect.poll(async () => {
        const hash = await page.evaluate(() => location.hash);
        return /#\/todos\?todo=/.test(hash);
    }).toBe(true);
    await expect(detail.getByRole('heading', { name: '编辑后的灵感待办' })).toBeVisible();
    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    const idea = stored.data.records.find(item => item.id === 'idea-convert');
    const todo = stored.data.todos.find(item => item.id === idea.ideaTodoId);
    expect(idea).toMatchObject({ ideaStatus: '待实践', ideaNextAction: '先做最小验证实验' });
    expect(idea.ideaTodoId).not.toBe('missing-todo');
    expect(todo).toMatchObject({
        text: '编辑后的灵感待办',
        note: '用户确认后的备注',
        group: '学习',
        dueDate: '2026-07-31',
        sourceType: 'idea-convert',
        sourceRecordId: 'idea-convert',
        subTodos: [{ text: '准备材料', done: false }],
    });
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.mirror.todos.map(item => item.id)).toContain(todo.id);
});

test('idea conversion draft cancel leaves lifePlanData and todo mirror untouched', async ({ page }) => {
    const source = emptyData({
        records: [{
            id: 'idea-draft-cancel', type: '灵感碎片', title: '取消草稿灵感', content: '不要落库',
            startDate: '2026-07-27', endDate: '2026-07-27', todoIds: [], ideaStatus: '待整理',
            ideaTags: [], ideaNextAction: '', ideaTodoId: '', ideaConclusion: '', updatedAt: '2026-07-27T08:00:00',
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => localStorage.setItem('lifePlanData', JSON.stringify(data)), source);
    await page.goto('/#/ideas');
    await page.locator('.idea-card').filter({ hasText: '取消草稿灵感' }).getByRole('button', { name: '转成待办' }).click();
    await expectHashRoute(page, '/todos', { ideaDraft: 'idea-draft-cancel' });
    const detail = page.locator('.todo-detail-panel');
    await detail.getByLabel('任务', { exact: true }).fill('临时草稿标题');
    await detail.getByRole('button', { name: '取消' }).click();
    await expect(page.locator('.todo-detail-panel')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('todoAppData'))).toBeNull();
});


test('AI page falls back when persisted config is malformed', async ({ page }) => {
    const source = emptyData({
        records: [{ id: 'ai-config-record', type: '日记', title: '保留的记录', content: '不要被配置解析影响', startDate: '2026-07-30', endDate: '2026-07-30', todoIds: [], updatedAt: '2026-07-30T08:00:00' }],
        todos: [todoFixture('ai-config-todo', '保留的待办')],
    });
    const original = JSON.stringify(source);
    const malformedConfig = '{"remoteEnabled":';
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ data, malformed }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanAiConfig', malformed);
    }, { data: source, malformed: malformedConfig });

    await page.goto('/#/ai');
    await expect(page.locator('#page-ai .page-title')).toHaveText('AI 助手');
    await expect(page.getByLabel('接口地址')).toBeVisible();
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanAiConfig'))).toBe(malformedConfig);
});

test('AI ideaNext keeps drafts read-only until confirmed writeback', async ({ page }) => {
    const source = emptyData({
        records: [{
            id: 'idea-ai-next', type: '灵感碎片', title: 'AI 灵感转化', content: '需要最小验证',
            startDate: '2026-07-30', endDate: '2026-07-30', todoIds: [], ideaStatus: '待整理',
            ideaTags: ['AI'], ideaNextAction: '', ideaTodoId: '', ideaConclusion: '', updatedAt: '2026-07-30T08:00:00',
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanAiConfig', JSON.stringify({ remoteEnabled: false, endpointUrl: '', model: '', apiKey: '' }));
    }, source);
    await page.goto('/#/ai?mode=ideaNext&idea=idea-ai-next');
    const aiPage = page.locator('#page-ai');
    await expect(aiPage.getByLabel('选择灵感')).toHaveValue('idea-ai-next');
    await aiPage.getByRole('button', { name: '生成灵感行动' }).click();
    await expect(aiPage.getByText('已生成建议，确认后再写入')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('todoAppData'))).toBeNull();

    await aiPage.getByLabel('标题').fill('验证灵感：最小实验');
    await aiPage.getByLabel('备注').fill('确认后才创建');
    await aiPage.getByRole('button', { name: '转成关联待办' }).click();
    await expect.poll(async () => page.evaluate(() => location.hash)).toMatch(/#\/todos\?todo=/);

    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    const idea = stored.data.records.find(item => item.id === 'idea-ai-next');
    const todo = stored.data.todos.find(item => item.id === idea.ideaTodoId);
    expect(idea).toMatchObject({
        ideaStatus: '待实践',
        ideaNextAction: '验证灵感：最小实验',
        ideaTodoId: todo.id,
    });
    expect(idea.todoIds).toEqual(expect.arrayContaining([todo.id]));
    expect(todo).toMatchObject({
        text: '验证灵感：最小实验',
        note: '确认后才创建',
        sourceType: 'idea-ai',
        sourceRecordId: 'idea-ai-next',
        group: '学习',
    });
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.mirror.todos.map(item => item.id)).toContain(todo.id);
});

test('AI diaryReview keeps diary drafts read-only until confirmed writeback', async ({ page }) => {
    const source = emptyData({
        records: [{
            id: 'diary-ai-page', type: '日记', title: '独立 AI 日记', content: '今天完成了迁移检查。明天整理同步边界。',
            startDate: '2026-07-30', endDate: '2026-07-30', todoIds: [], templateId: '', updatedAt: '2026-07-30T21:00:00',
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanAiConfig', JSON.stringify({ remoteEnabled: false, endpointUrl: '', model: '', apiKey: '' }));
    }, source);

    await page.goto('/#/ai?mode=diaryReview&diary=diary-ai-page');
    const aiPage = page.locator('#page-ai');
    await expect(aiPage.locator('.ai-mode-tabs button.active')).toHaveText('日记分析');
    await expect(aiPage.getByLabel('选择日记')).toHaveValue('diary-ai-page');
    await aiPage.getByLabel('AI 日记分析').fill('复盘要简短，保留明日动作。');
    await aiPage.getByRole('button', { name: '生成日记分析' }).click();
    await expect(aiPage.getByText('已生成建议，确认后再写入')).toBeVisible();
    await expect(aiPage.getByLabel('AI 复盘草稿')).toBeVisible();
    await expect(aiPage.getByLabel('AI 明日重点草稿')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('todoAppData'))).toBeNull();

    await aiPage.getByLabel('AI 复盘草稿').fill('确认后的独立日记复盘。');
    await aiPage.getByRole('button', { name: '写入所选日记字段' }).click();
    await expect(aiPage.getByText('已写入：复盘、明日重点')).toBeVisible();
    await aiPage.getByRole('button', { name: '创建所选待办' }).click();

    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    const diary = stored.data.records.find(item => item.id === 'diary-ai-page');
    expect(diary.content).toContain('# 复盘\n确认后的独立日记复盘。');
    expect(diary.content).toContain('# 明日重点');
    expect(stored.data.todos).toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceType: 'diary-ai', sourceRecordId: 'diary-ai-page' }),
    ]));
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
});

test('AI todayPlan keeps drafts read-only until confirmed writeback with sourceType ai', async ({ page }) => {
    const today = (() => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();
    const yesterday = (() => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })();
    const source = emptyData({
        todos: [
            todoFixture('todo-overdue-plan', '补上过期复盘', { dueDate: yesterday, urgency: 'high', group: '工作' }),
            todoFixture('todo-today-plan', '推进首页迁移', { dueDate: today, urgency: 'medium', group: '迁移' }),
            todoFixture('todo-float-plan', '浮动阅读半小时', { urgency: 'low', group: '生活' }),
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanAiConfig', JSON.stringify({ remoteEnabled: false, endpointUrl: '', model: '', apiKey: '' }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'ai-today-plan-before' }));
    }, source);

    await page.goto('/#/ai?mode=todayPlan');
    const aiPage = page.locator('#page-ai');
    await expect(aiPage.locator('.ai-mode-tabs button.active')).toHaveText('今日计划');
    await aiPage.getByLabel('AI 今日计划').fill('优先补逾期，再推进一个迁移事项。');
    await aiPage.getByRole('button', { name: '生成今日计划', exact: true }).click();
    await expect(aiPage.getByText('已生成建议，确认后再写入')).toBeVisible();
    await expect(aiPage.locator('.ai-result-item').first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('todoAppData'))).toBeNull();

    await page.locator('#ai-draft-text-0').fill('今天先补过期复盘');
    await page.locator('#ai-draft-note-0').fill('确认后写入的今日计划');
    await page.locator('#ai-draft-group-0').fill('工作');
    await aiPage.getByRole('button', { name: '加入今日待办', exact: true }).click();
    await expect(aiPage.getByText(/已加入今日待办/)).toBeVisible();

    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
        sync: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    const created = stored.data.todos.filter(item => item.sourceType === 'ai');
    expect(created.length).toBeGreaterThan(0);
    const edited = created.find(item => item.text === '今天先补过期复盘');
    expect(edited).toMatchObject({
        text: '今天先补过期复盘',
        note: '确认后写入的今日计划',
        group: '工作',
        sourceType: 'ai',
    });
    expect(edited.planStartDate).toBe(today);
    expect(edited.planEndDate).toBe(today);
    expect(stored.sync.dirty).toBe(true);
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mirror.todos).toEqual(expect.arrayContaining([
        expect.objectContaining({ text: '今天先补过期复盘', sourceType: 'ai' }),
    ]));
});

test('AI todayPlan orders relevant todos by legacy focus priority', async ({ page }) => {
    const today = localDate();
    const source = emptyData({
        todos: [
            todoFixture('todo-ai-low-today', '低优先级今日待办', { dueDate: today, urgency: 'low', group: '生活' }),
            todoFixture('todo-ai-high-today', '高优先级今日待办', { dueDate: today, urgency: 'high', group: '工作' }),
        ],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanAiConfig', JSON.stringify({ remoteEnabled: false, endpointUrl: '', model: '', apiKey: '' }));
    }, source);

    await page.goto('/#/ai?mode=todayPlan');
    const aiPage = page.locator('#page-ai');
    await aiPage.getByRole('button', { name: '生成今日计划', exact: true }).click();
    await expect(aiPage.getByText('已生成建议，确认后再写入')).toBeVisible();
    await expect(aiPage.locator('#ai-draft-text-0')).toHaveValue('推进：高优先级今日待办');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
});

test('AI remote failure falls back to local drafts before confirmation', async ({ page }) => {
    const source = emptyData({
        todos: [todoFixture('todo-ai-fallback', '远程失败后仍要推进的待办', { group: '迁移' })],
    });
    const original = JSON.stringify(source);
    let remoteRequests = 0;
    await page.route('https://ai-fallback.example.test/**', async route => {
        remoteRequests += 1;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'temporary outage' }) });
    });
    await page.addInitScript(({ data }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanAiConfig', JSON.stringify({ remoteEnabled: true, endpointUrl: 'https://ai-fallback.example.test/v1', model: 'fallback-model', apiKey: 'fallback-key' }));
    }, { data: source });
    await page.goto('/#/ai?mode=todayPlan');
    const aiPage = page.locator('#page-ai');
    await aiPage.getByRole('button', { name: '生成今日计划' }).click();

    await expect.poll(() => remoteRequests).toBe(1);
    await expect(aiPage.getByRole('status')).toContainText('已改用本地规则生成建议');
    await expect(aiPage).toContainText('今日计划建议');
    await expect(aiPage.locator('.ai-result-item input[id^="ai-draft-text-"]').first()).toHaveValue('推进：远程失败后仍要推进的待办');
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('todoAppData'))).toBeNull();
});

test('AI chatCapture keeps multi-destination drafts read-only until confirmed writeback', async ({ page }) => {
    const dateAt = amount => {
        const date = new Date();
        date.setDate(date.getDate() + amount);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const today = dateAt(0);
    const yesterday = dateAt(-1);
    const source = emptyData({
        records: [{
            id: 'today-plan-existing', type: '日计划', title: '已有今日计划', content: '旧计划正文',
            startDate: today, endDate: today, recordTime: '', recordEndTime: '', todoIds: [],
            templateId: '', updatedAt: `${today}T08:00:00`,
        }],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanAiConfig', JSON.stringify({ remoteEnabled: false, endpointUrl: '', model: '', apiKey: '' }));
    }, source);
    await page.goto('/#/ai?mode=chatCapture');
    const aiPage = page.locator('#page-ai');
    await aiPage.getByLabel('AI 对话整理').fill('明天想把 Vue AI 对话整理跑通，顺手记个待办；今天工作里把页面写回做完了。这个想法先放灵感池。');
    await aiPage.getByRole('button', { name: '生成建议' }).click();
    await expect(aiPage.getByText('已生成建议，确认后再写入')).toBeVisible();
    await expect(page.locator('#ai-capture-draft-diaryText')).toHaveValue(/Vue AI 对话整理/);
    await expect(page.locator('#ai-capture-draft-workText')).toHaveValue(/页面写回|Vue AI/);
    await expect(page.locator('#ai-capture-draft-planText')).toHaveValue(/明天|待办|Vue AI/);
    await expect(page.locator('#ai-capture-draft-ideaText')).toHaveValue(/灵感池|想法/);
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('todoAppData'))).toBeNull();

    await page.locator('#ai-draft-text-0').fill('检查 AI 对话整理首屏');
    await page.locator('#ai-draft-note-0').fill('确认后创建的待办备注');
    await page.locator('#ai-draft-due-0').fill(today);
    await page.locator('#ai-draft-plan-start-0').fill(yesterday);
    await page.locator('#ai-draft-plan-end-0').fill(today);
    await page.locator('#ai-draft-group-0').fill('迁移');
    await page.locator('#ai-capture-draft-workText').fill('编辑后的工作记录：chatCapture 多落点写回完成。');
    await page.locator('#ai-capture-draft-planText').fill('编辑后的日计划：先检查 AI 页面写回。');
    await page.locator('#ai-capture-draft-ideaText').fill('编辑后的灵感：把对话整理做成轻量收集入口。');
    await page.locator('#ai-capture-draft-diaryText').fill('编辑后的日记：今天把 AI 对话整理接进 Vue。');

    await aiPage.getByRole('button', { name: '创建这些待办' }).click();
    await expect(aiPage.getByText(/已创建待办/)).toBeVisible();
    let stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
        sync: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    const captureTodo = stored.data.todos.find(item => item.sourceType === 'ai-capture');
    expect(captureTodo).toMatchObject({
        text: '检查 AI 对话整理首屏',
        note: '确认后创建的待办备注',
        dueDate: today,
        planStartDate: yesterday,
        planEndDate: today,
        group: '迁移',
    });
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.mirror.todos.map(item => item.id)).toContain(captureTodo.id);
    expect(stored.sync.dirty).toBe(true);
    expect(stored.data.records).toHaveLength(1);

    await aiPage.getByRole('button', { name: '创建工作记录' }).click();
    await aiPage.getByRole('button', { name: '写入日计划' }).click();
    await aiPage.getByRole('button', { name: '存为灵感' }).click();
    await aiPage.getByRole('button', { name: '追加到日记' }).click();

    stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
        sync: JSON.parse(localStorage.getItem('lifePlanSyncState')),
    }));
    const work = stored.data.records.find(item => item.type === '工作记录');
    const plan = stored.data.records.find(item => item.id === 'today-plan-existing');
    const idea = stored.data.records.find(item => item.type === '灵感碎片');
    const diary = stored.data.records.find(item => item.type === '日记');
    expect(work.content).toContain('编辑后的工作记录');
    expect(plan.content).toContain('旧计划正文');
    expect(plan.content).toContain('# AI 对话整理');
    expect(plan.content).toContain('编辑后的日计划');
    expect(stored.data.records.filter(item => item.type === '日计划')).toHaveLength(1);
    expect(idea).toMatchObject({ ideaStatus: '待整理', ideaTags: ['AI整理'] });
    expect(idea.content).toContain('编辑后的灵感');
    expect(diary.templateId).toBe('builtin-diary-daily-review');
    expect(diary.content).toContain('# 正文');
    expect(diary.content).toContain('编辑后的日记');
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.sync.dirty).toBe(true);
});

test('AI todoBreakdown writes selected subtasks only after confirmation', async ({ page }) => {
    const source = emptyData({
        todos: [todoFixture('todo-break', '拆解这个待办', {
            note: '原备注',
            group: '工作',
            subTodos: [{ text: '已有步骤', done: false }],
        })],
    });
    const original = JSON.stringify(source);
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanAiConfig', JSON.stringify({ remoteEnabled: false }));
    }, source);
    await page.goto('/#/ai?mode=todoBreakdown&todo=todo-break');
    const aiPage = page.locator('#page-ai');
    await expect(aiPage.getByLabel('选择待办')).toHaveValue('todo-break');
    await aiPage.getByRole('button', { name: '生成子任务' }).click();
    await expect(aiPage.getByText('已生成建议，确认后再写入')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('lifePlanData'))).toBe(original);

    await aiPage.getByLabel('标题').first().fill('准备材料');
    await aiPage.getByRole('button', { name: '写入子任务' }).click();
    await expect(aiPage.getByText(/已写入子任务/)).toBeVisible();

    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('todoAppData')),
    }));
    const todo = stored.data.todos.find(item => item.id === 'todo-break');
    expect(todo.subTodos.map(item => item.text)).toEqual(expect.arrayContaining(['已有步骤', '准备材料']));
    expect(todo.note).toContain('原备注');
    expect(todo.note).toContain('AI 拆解：');
    expect(stored.mirror.todos[0].subTodos.map(item => item.text)).toEqual(expect.arrayContaining(['已有步骤', '准备材料']));
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
    await page.getByRole('dialog', { name: '记录预览' }).getByRole('button', { name: '编辑', exact: true }).click();
    const editor = page.locator('.record-editor-panel');
    await editor.getByLabel('内容').fill('三秒后保存的内容');
    await expect(editor.getByRole('status')).toHaveText('有未保存修改');
    await expect(editor.getByLabel('内容')).toHaveValue('三秒后保存的内容');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records.find(item => item.id === 'record-autosave').content)).toBe('旧内容');
    await page.waitForTimeout(3200);
    await expect(editor.getByRole('status')).toContainText('已自动保存于', { timeout: 5000 });
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records.find(item => item.id === 'record-autosave')).toMatchObject({ content: '三秒后保存的内容' });
    expect(stored.records.find(item => item.id === 'record-autosave').updatedAt).not.toBe('2026-07-27T08:00:00');

    await editor.getByLabel('标题').fill('关闭前刷新记录');
    await editor.getByRole('button', { name: '关闭' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records.find(item => item.id === 'record-autosave').title).toBe('关闭前刷新记录');

    await page.getByRole('button', { name: /关闭前刷新记录/ }).first().click();
    await page.getByRole('dialog', { name: '记录预览' }).getByRole('button', { name: '编辑', exact: true }).click();
    await editor.getByLabel('内容').fill('切换记录前刷新');
    await page.getByRole('button', { name: /切换目标记录/ }).first().click();
    await page.getByRole('dialog', { name: '记录预览' }).getByRole('button', { name: '编辑', exact: true }).click();
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

    await page.locator('#page-records').getByRole('button', { name: /新建记录/ }).click();
    let modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: '日记', exact: true }).click();
    await expect(modal.getByLabel('标题')).toHaveValue(/^\d{4}年\d{1,2}月\d{1,2}日 星期[一二三四五六日]$/);
    await expect(modal.getByLabel('记录模板')).toHaveValue('builtin:builtin-diary-daily-review');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')).records)).toEqual([]);

    await page.locator('#page-records').getByRole('button', { name: /新建记录/ }).click();
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

    await page.locator('#page-records').getByRole('button', { name: /新建记录/ }).click();
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
    await page.locator('#page-records').getByRole('button', { name: /新建记录/ }).click();
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
    await page.getByRole('dialog', { name: '记录预览' }).getByRole('button', { name: '编辑', exact: true }).click();
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

test('habit remote preview stays GET-only and leaves local habit mirrors untouched', async ({ page }) => {
    const local = emptyData({
        habits: [{
            id: 'habit-local-sync',
            name: '本机习惯',
            tag: '健康',
            rule: 'daily',
            timesPerDay: '1',
            rewardPoints: 2,
            rewardCurrency: '金币',
            startDate: '2026-07-27',
            createdAt: '2026-07-27T08:00:00',
            updatedAt: '2026-07-27T08:00:00',
        }],
        checkins: [{
            id: 'checkin-local-sync',
            habitId: 'habit-local-sync',
            date: '2026-07-27',
            time: '08:00',
            checkinAt: '2026-07-27T08:00:00',
            note: '',
            createdAt: '2026-07-27T08:00:00',
            updatedAt: '2026-07-27T08:00:00',
        }],
        habitPointLedger: [{
            id: 'ledger-local-sync',
            habitId: 'habit-local-sync',
            sourceId: 'checkin-local-sync',
            type: 'checkin',
            amount: 2,
            currency: '金币',
            date: '2026-07-27',
            createdAt: '2026-07-27T08:00:00',
            updatedAt: '2026-07-27T08:00:00',
        }],
    });
    const remote = habitRemoteSnapshot({
        habits: [{ id: 'life-plan/habits/habit-remote-sync', title: '云端习惯', updatedAt: '2026-07-27T09:00:00' }],
        habitRecords: [{ id: 'life-plan/checkins/checkin-remote-sync', habitId: 'life-plan/habits/habit-remote-sync', date: '2026-07-27', sourceKey: 'remote-checkin', updatedAt: '2026-07-27T09:10:00' }],
        habitLedger: [{ id: 'life-plan/ledger/ledger-remote-sync', type: 'checkin', sourceId: 'remote-checkin', currency: '金币', amount: 5, updatedAt: '2026-07-27T09:10:00' }],
        habitCurrencies: [{ id: 'default', name: '金币' }],
    });
    const original = JSON.stringify(local);
    const mirror = JSON.stringify({ localMirror: true, remoteUploadEnabled: true, mirror: { reason: 'pre-vue-preview' }, habits: [] });
    const syncState = JSON.stringify({ dirty: true, lastRemoteHash: 'old-habit-hash' });
    const requests = [];
    await page.route('https://habit-vue.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        requests.push({ method: request.method(), path: url.pathname });
        if (request.method() === 'GET' && url.pathname === '/apps/habit-app/data.json') {
            await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"habit-vue-v1"' }, body: JSON.stringify(remote) });
            return;
        }
        await route.fulfill({ status: 405, body: '' });
    });
    await page.addInitScript(({ localData, mirrorData, stateData }) => {
        localStorage.setItem('lifePlanData', localData);
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://habit-vue.example.test', remotePath: '/life-plan.json', autoSync: true }));
        localStorage.setItem('habitAppData', mirrorData);
        localStorage.setItem('habitAppSyncConfig', JSON.stringify({ remotePath: '/unsafe-habit.json', autoSync: true, remoteUploadEnabled: true }));
        localStorage.setItem('habitAppSyncState', stateData);
    }, { localData: original, mirrorData: mirror, stateData: syncState });

    await page.goto('/#/sync');
    const panel = page.locator('.habit-sync-card');
    await expect(panel).toContainText('/apps/habit-app/data.json');
    await panel.getByRole('button', { name: '检查 Habit 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('只读预检完成');
    await expect(panel).toContainText('本机');
    await expect(panel).toContainText('云端');
    await expect(panel).toContainText('合并');

    const stored = await page.evaluate(() => ({
        data: localStorage.getItem('lifePlanData'),
        mirror: localStorage.getItem('habitAppData'),
        syncState: localStorage.getItem('habitAppSyncState'),
        config: JSON.parse(localStorage.getItem('habitAppSyncConfig')),
    }));
    expect(requests).toEqual([{ method: 'GET', path: '/apps/habit-app/data.json' }]);
    expect(stored.data).toBe(original);
    expect(stored.mirror).toBe(mirror);
    expect(stored.syncState).toBe(syncState);
    expect(stored.config).toMatchObject({ remotePath: '/apps/habit-app/data.json', autoSync: false, remoteUploadEnabled: false });
});

test('habit remote apply rechecks then persists the merged legacy contract', async ({ page }) => {
    const local = emptyData({
        habits: [{
            id: 'habit-local-sync',
            name: '本机习惯',
            tag: '健康',
            rule: 'weekly-fixed',
            weekdays: [1, 3, 5],
            timesPerDay: 2,
            rewardPoints: 2,
            rewardCurrency: '金币',
            startDate: '2026-07-27',
            createdAt: '2026-07-27T08:00:00',
            updatedAt: '2026-07-27T08:00:00',
        }],
        checkins: [{
            id: 'checkin-local-sync',
            habitId: 'habit-local-sync',
            date: '2026-07-27',
            time: '08:00',
            checkinAt: '2026-07-27T08:00:00',
            note: '',
            createdAt: '2026-07-27T08:00:00',
            updatedAt: '2026-07-27T08:00:00',
        }],
        habitPointLedger: [{
            id: 'ledger-local-sync',
            habitId: 'habit-local-sync',
            sourceId: 'checkin-local-sync',
            type: 'checkin',
            amount: 2,
            currency: '金币',
            date: '2026-07-27',
            createdAt: '2026-07-27T08:00:00',
            updatedAt: '2026-07-27T08:00:00',
        }],
        habitCurrencies: [{ id: 'currency-coin', name: '金币' }],
    });
    const remote = habitRemoteSnapshot({
        habits: [{
            id: 'mobile/habits/habit-phone',
            title: '手机新增习惯',
            groupId: 'default',
            repeatUnit: 'weekly',
            weekdays: [2, 4],
            requiredCountPerDay: 1,
            rewardAmount: 4,
            rewardCurrencyId: 'default',
            fineAmount: 1,
            fineCurrencyId: 'default',
            icon: 'S',
            color: '#4f7cac',
            sort: 4,
            createdAt: '2026-07-28T08:00:00',
            updatedAt: '2026-07-28T08:00:00',
        }],
        habitRecords: [{
            id: 'mobile/records/record-phone',
            habitId: 'mobile/habits/habit-phone',
            recordDate: '2026-07-28',
            recordTime: '2026-07-28T08:30:00',
            type: 'normal',
            note: '手机打卡',
            createdAt: '2026-07-28T08:30:00',
            updatedAt: '2026-07-28T08:30:00',
        }],
        habitRewards: [{
            id: 'mobile/rewards/reward-phone',
            name: '手机心愿',
            description: '云端心愿说明',
            cost: 8,
            currencyId: 'default',
            createdAt: '2026-07-28T08:40:00',
            updatedAt: '2026-07-28T08:40:00',
        }],
        habitLedger: [{
            id: 'mobile/ledger/ledger-phone',
            type: 'reward_redeem',
            habitId: 'mobile/habits/habit-phone',
            rewardId: 'mobile/rewards/reward-phone',
            sourceId: 'mobile/rewards/reward-phone',
            amount: -8,
            currencyId: 'default',
            date: '2026-07-28',
            createdAt: '2026-07-28T08:45:00',
            updatedAt: '2026-07-28T08:45:00',
        }],
        habitCurrencies: [{ id: 'default', name: '金币' }],
        deletedItems: [{ collection: 'habitRecords', id: 'life-plan/checkins/checkin-old-cloud', deletedAt: '2026-07-28T09:00:00', reason: 'remote-delete', parentId: 'life-plan/habits/habit-old' }],
    });
    const requests = [];
    await page.route('https://habit-apply.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        requests.push({ method: request.method(), path: url.pathname });
        if (request.method() === 'GET' && url.pathname === '/apps/habit-app/data.json') {
            await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"habit-apply-v1"', 'Access-Control-Expose-Headers': 'ETag' }, body: JSON.stringify(remote) });
            return;
        }
        await route.fulfill({ status: 405, body: '' });
    });
    await page.addInitScript(({ localData }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://habit-apply.example.test', remotePath: '/life-plan.json', autoSync: true }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false }));
        localStorage.setItem('habitAppSyncConfig', JSON.stringify({ remotePath: '/unsafe-habit.json', autoSync: true, remoteUploadEnabled: true }));
        localStorage.removeItem('todoAppData');
    }, { localData: local });

    await page.goto('/#/sync');
    const panel = page.locator('.habit-sync-card');
    await panel.getByRole('button', { name: '检查 Habit 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('只读预检完成');
    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: '应用合并到本机' }).click();
    await expect(panel.getByRole('status')).toContainText('已应用');

    const applied = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        mirror: JSON.parse(localStorage.getItem('habitAppData')),
        syncState: JSON.parse(localStorage.getItem('habitAppSyncState')),
        mainState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
        snapshots: JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'),
    }));
    expect(requests).toEqual([
        { method: 'GET', path: '/apps/habit-app/data.json' },
        { method: 'GET', path: '/apps/habit-app/data.json' },
    ]);
    expect(applied.data.habits.map(item => item.id)).toEqual(expect.arrayContaining(['habit-local-sync', 'mobile/habits/habit-phone']));
    const remoteHabit = applied.data.habits.find(item => item.id === 'mobile/habits/habit-phone');
    expect(remoteHabit).toMatchObject({ remoteId: 'mobile/habits/habit-phone', name: '手机新增习惯', rule: 'weekly-fixed', weekdays: [2, 4], rewardPoints: 4, penaltyPoints: 1, color: '#4f7cac' });
    expect(applied.data.checkins).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'mobile/records/record-phone', remoteId: 'mobile/records/record-phone', habitId: 'mobile/habits/habit-phone', date: '2026-07-28', note: '手机打卡' }),
    ]));
    expect(applied.data.habitRewards).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'mobile/rewards/reward-phone', remoteId: 'mobile/rewards/reward-phone', name: '手机心愿', cost: 8 }),
    ]));
    expect(applied.data.habitPointLedger).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'mobile/ledger/ledger-phone', habitId: 'mobile/habits/habit-phone', rewardId: 'mobile/rewards/reward-phone', sourceId: 'mobile/rewards/reward-phone', type: 'redeem', amount: -8 }),
    ]));
    expect(applied.data.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'checkins', id: 'checkin-old-cloud', parentId: 'habit-old', reason: 'remote-delete' }),
    ]));
    expect(applied.mirror.localMirror).toBe(true);
    expect(applied.mirror.remoteUploadEnabled).toBe(false);
    expect(applied.mirror.mirror.reason).toBe('habit-cloud-apply');
    expect(applied.mirror.habits.some(item => item.title === '手机新增习惯' || item.name === '手机新增习惯')).toBe(true);
    expect(applied.mainState.dirty).toBe(true);
    expect(applied.syncState.dirty).toBe(true);
    expect(applied.syncState.lastLocalHash).toEqual(expect.any(String));
    expect(applied.syncState.lastRemoteHash).toEqual(expect.any(String));
    expect(applied.syncState.lastRemoteEtag).toBe('"habit-apply-v1"');
    expect(applied.syncState.lastPullAt).toEqual(expect.any(String));
    expect(applied.syncState.lastSyncAt).toEqual(expect.any(String));
    expect(applied.snapshots.some(item => item.reason === '应用 Habit 云端合并结果前')).toBe(true);
});

test('habit remote apply stops before persistence when cloud changed after preview', async ({ page }) => {
    const local = emptyData({
        habits: [{ id: 'habit-local-race', name: '本机竞态习惯', rule: 'daily', timesPerDay: 1, rewardPoints: 1, rewardCurrency: '金币', createdAt: '2026-07-27T08:00:00', updatedAt: '2026-07-27T08:00:00' }],
    });
    const remoteBefore = habitRemoteSnapshot({
        habits: [{ id: 'life-plan/habits/habit-before-race', title: '变更前习惯', updatedAt: '2026-07-28T08:00:00' }],
        habitCurrencies: [{ id: 'default', name: '金币' }],
    });
    const remoteAfter = habitRemoteSnapshot({
        habits: [{ id: 'life-plan/habits/habit-after-race', title: '变更后习惯', updatedAt: '2026-07-28T09:00:00' }],
        habitCurrencies: [{ id: 'default', name: '金币' }],
    });
    const original = JSON.stringify(local);
    const mirror = JSON.stringify({ localMirror: true, remoteUploadEnabled: true, mirror: { reason: 'pre-race' }, habits: [] });
    let getCount = 0;
    const requests = [];
    await page.route('https://habit-race.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        requests.push({ method: request.method(), path: url.pathname });
        if (request.method() === 'GET' && url.pathname === '/apps/habit-app/data.json') {
            getCount += 1;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { ETag: getCount === 1 ? '"habit-race-v1"' : '"habit-race-v2"', 'Access-Control-Expose-Headers': 'ETag' },
                body: JSON.stringify(getCount === 1 ? remoteBefore : remoteAfter),
            });
            return;
        }
        await route.fulfill({ status: 405, body: '' });
    });
    await page.addInitScript(({ localData, mirrorData }) => {
        localStorage.setItem('lifePlanData', localData);
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://habit-race.example.test', remotePath: '/life-plan.json', autoSync: true }));
        localStorage.setItem('habitAppData', mirrorData);
        localStorage.setItem('habitAppSyncState', JSON.stringify({ dirty: true, lastRemoteHash: 'old-habit-race' }));
    }, { localData: original, mirrorData: mirror });

    await page.goto('/#/sync');
    const panel = page.locator('.habit-sync-card');
    await panel.getByRole('button', { name: '检查 Habit 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('只读预检完成');
    await panel.getByRole('button', { name: '应用合并到本机' }).click();
    await expect(panel.getByRole('status')).toContainText('云端自预览后已变化');

    const result = await page.evaluate(() => ({
        data: localStorage.getItem('lifePlanData'),
        mirror: localStorage.getItem('habitAppData'),
        syncState: JSON.parse(localStorage.getItem('habitAppSyncState')),
        snapshots: JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'),
    }));
    expect(requests).toEqual([
        { method: 'GET', path: '/apps/habit-app/data.json' },
        { method: 'GET', path: '/apps/habit-app/data.json' },
    ]);
    expect(result.data).toBe(original);
    expect(result.mirror).toBe(mirror);
    expect(result.snapshots.some(item => item.reason === '应用 Habit 云端合并结果前')).toBe(false);
    expect(result.syncState.lastConflictAt).toEqual(expect.any(String));
    expect(result.syncState.lastRemoteHash).toEqual(expect.any(String));
    expect(result.syncState.lastRemoteEtag).toBe('"habit-race-v2"');
});

test('habit existing remote upload uses If-Match and verifies the written snapshot', async ({ page }) => {
    const local = emptyData({
        habits: [{
            id: 'habit-existing-local',
            name: '本机新版习惯',
            tag: '健康',
            rule: 'daily',
            timesPerDay: 1,
            rewardPoints: 3,
            rewardCurrency: '金币',
            startDate: '2026-07-29',
            createdAt: '2026-07-29T08:00:00',
            updatedAt: '2026-07-29T10:00:00',
        }],
        checkins: [{
            id: 'checkin-existing-local',
            habitId: 'habit-existing-local',
            date: '2026-07-29',
            time: '10:00',
            checkinAt: '2026-07-29T10:00:00',
            note: '本机新版打卡',
            createdAt: '2026-07-29T10:00:00',
            updatedAt: '2026-07-29T10:00:00',
        }],
        habitPointLedger: [{
            id: 'ledger-existing-local',
            habitId: 'habit-existing-local',
            sourceId: 'checkin-existing-local',
            type: 'checkin',
            amount: 3,
            currency: '金币',
            date: '2026-07-29',
            createdAt: '2026-07-29T10:00:00',
            updatedAt: '2026-07-29T10:00:00',
        }],
        habitCurrencies: [{ id: 'currency-coin', name: '金币' }],
    });
    const remote = habitRemoteSnapshot({
        habits: [{ id: 'life-plan/habits/habit-existing-remote', title: '云端旧版习惯', updatedAt: '2026-07-29T08:00:00' }],
        habitCurrencies: [{ id: 'default', name: '金币' }],
    });
    await page.addInitScript(({ localData, remoteData }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('habitAppSyncConfig', JSON.stringify({ remotePath: '/unsafe-habit.json', autoSync: true, remoteUploadEnabled: true }));
        window.__habitSyncRequests = [];
        window.__habitUploaded = null;
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__habitSyncRequests.push({ url: String(url), method, headers: options.headers || {}, body: options.body || '' });
            if (method === 'PUT') {
                window.__habitUploaded = JSON.parse(options.body);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ETag: '"habit-existing-v2"' } });
            }
            if (method === 'GET') {
                const fileGets = window.__habitSyncRequests.filter(item => item.method === 'GET').length;
                const body = fileGets >= 3 && window.__habitUploaded ? window.__habitUploaded : remoteData;
                return new Response(JSON.stringify(body), { status: 200, headers: { ETag: fileGets >= 3 ? '"habit-existing-v2"' : '"habit-existing-v1"', 'Content-Type': 'application/json' } });
            }
            return new Response('', { status: 200 });
        };
    }, { localData: local, remoteData: remote });

    await page.goto('/#/sync');
    const panel = page.locator('.habit-sync-card');
    await panel.getByRole('button', { name: '检查 Habit 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('只读预检完成');
    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: '受保护上传' }).click();
    await expect(panel.getByRole('status')).toContainText('回读核验一致');

    const result = await page.evaluate(() => ({
        requests: window.__habitSyncRequests,
        uploaded: window.__habitUploaded,
        state: JSON.parse(localStorage.getItem('habitAppSyncState')),
        config: JSON.parse(localStorage.getItem('habitAppSyncConfig')),
        data: JSON.parse(localStorage.getItem('lifePlanData')),
    }));
    const fileRequests = result.requests.filter(item => item.url.includes('/apps/habit-app/data.json'));
    expect(fileRequests.map(item => item.method)).toEqual(['GET', 'GET', 'PUT', 'GET']);
    const put = fileRequests.find(item => item.method === 'PUT');
    expect(put.headers['If-Match'] || put.headers['if-match']).toBe('"habit-existing-v1"');
    expect(result.uploaded.habits.some(item => item.title === '本机新版习惯' || item.name === '本机新版习惯')).toBe(true);
    expect(result.uploaded.habitRecords).toEqual(expect.arrayContaining([
        expect.objectContaining({ note: '本机新版打卡' }),
    ]));
    expect(result.data.habits[0].name).toBe('本机新版习惯');
    expect(result.state).toMatchObject({ dirty: false, lastRemoteEtag: '"habit-existing-v2"' });
    expect(result.config).toMatchObject({ remotePath: '/apps/habit-app/data.json', autoSync: false, remoteUploadEnabled: false });
});

test('habit existing upload stops before PUT when the remote changed after preview', async ({ page }) => {
    const local = emptyData({
        habits: [{
            id: 'habit-upload-race-local',
            name: '上传竞态本机习惯',
            rule: 'daily',
            timesPerDay: 1,
            rewardPoints: 1,
            rewardCurrency: '金币',
            createdAt: '2026-07-29T08:00:00',
            updatedAt: '2026-07-29T10:00:00',
        }],
    });
    const remoteBefore = habitRemoteSnapshot({
        habits: [{ id: 'life-plan/habits/habit-upload-race-before', title: '预览云端习惯', updatedAt: '2026-07-29T08:00:00' }],
        habitCurrencies: [{ id: 'default', name: '金币' }],
    });
    const remoteAfter = habitRemoteSnapshot({
        habits: [
            { id: 'life-plan/habits/habit-upload-race-before', title: '预览云端习惯', updatedAt: '2026-07-29T08:00:00' },
            { id: 'life-plan/habits/habit-upload-race-after', title: '另一设备新增习惯', updatedAt: '2026-07-29T10:30:00' },
        ],
        habitCurrencies: [{ id: 'default', name: '金币' }],
    });
    await page.addInitScript(({ localData, firstRemote, secondRemote }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        window.__habitSyncRequests = [];
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__habitSyncRequests.push({ url: String(url), method, headers: options.headers || {} });
            if (method === 'GET') {
                const count = window.__habitSyncRequests.filter(item => item.method === 'GET').length;
                return new Response(JSON.stringify(count === 1 ? firstRemote : secondRemote), {
                    status: 200,
                    headers: { ETag: count === 1 ? '"habit-upload-race-v1"' : '"habit-upload-race-v2"', 'Content-Type': 'application/json' },
                });
            }
            return new Response('', { status: 200 });
        };
    }, { localData: local, firstRemote: remoteBefore, secondRemote: remoteAfter });

    await page.goto('/#/sync');
    const panel = page.locator('.habit-sync-card');
    await panel.getByRole('button', { name: '检查 Habit 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('只读预检完成');
    await panel.getByRole('button', { name: '受保护上传' }).click();
    await expect(panel.getByRole('status')).toContainText('云端自上次检查后已变化');

    const result = await page.evaluate(() => ({
        methods: window.__habitSyncRequests.map(item => item.method),
        state: JSON.parse(localStorage.getItem('habitAppSyncState')),
        data: JSON.parse(localStorage.getItem('lifePlanData')),
    }));
    expect(result.methods).toEqual(['GET', 'GET']);
    expect(result.data.habits[0].name).toBe('上传竞态本机习惯');
    expect(result.state.lastConflictAt).toBeTruthy();
    expect(result.state.lastRemoteEtag).toBe('"habit-upload-race-v2"');
});

test('habit first remote creation requires session arm and uses If-None-Match', async ({ page }) => {
    const local = emptyData({
        habits: [{
            id: 'habit-first-sync',
            name: '首次云端习惯',
            tag: '健康',
            rule: 'daily',
            timesPerDay: 1,
            rewardPoints: 3,
            rewardCurrency: '金币',
            startDate: '2026-07-29',
            createdAt: '2026-07-29T08:00:00',
            updatedAt: '2026-07-29T08:00:00',
        }],
        checkins: [{
            id: 'checkin-first-sync',
            habitId: 'habit-first-sync',
            date: '2026-07-29',
            time: '08:00',
            checkinAt: '2026-07-29T08:00:00',
            note: '首次创建打卡',
            createdAt: '2026-07-29T08:00:00',
            updatedAt: '2026-07-29T08:00:00',
        }],
        habitPointLedger: [{
            id: 'ledger-first-sync',
            habitId: 'habit-first-sync',
            sourceId: 'checkin-first-sync',
            type: 'checkin',
            amount: 3,
            currency: '金币',
            date: '2026-07-29',
            createdAt: '2026-07-29T08:00:00',
            updatedAt: '2026-07-29T08:00:00',
        }],
        habitCurrencies: [{ id: 'currency-coin', name: '金币' }],
    });
    await page.addInitScript(localData => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('habitAppSyncConfig', JSON.stringify({ remotePath: '/unsafe-habit.json', autoSync: true, remoteUploadEnabled: true }));
        localStorage.setItem('habitAppSyncState', JSON.stringify({ dirty: true, lastRemoteHash: 'old-habit-created' }));
        window.__habitSyncRequests = [];
        window.__habitUploaded = null;
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__habitSyncRequests.push({ url: String(url), method, headers: options.headers || {}, body: options.body || '' });
            if (method === 'PUT') {
                window.__habitUploaded = JSON.parse(options.body);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ETag: '"habit-created"' } });
            }
            if (method === 'GET') {
                if (!window.__habitUploaded) return new Response('missing', { status: 404 });
                return new Response(JSON.stringify(window.__habitUploaded), { status: 200, headers: { ETag: '"habit-created"', 'Content-Type': 'application/json' } });
            }
            return new Response('', { status: 200 });
        };
    }, local);

    await page.goto('/#/sync');
    const panel = page.locator('.habit-sync-card');
    await panel.getByRole('button', { name: '检查 Habit 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('不存在');
    await expect(panel.getByRole('checkbox', { name: '本次会话允许首次创建' })).not.toBeChecked();
    expect(await page.evaluate(() => window.__habitSyncRequests.filter(item => item.method === 'PUT').length)).toBe(0);
    await panel.getByRole('checkbox', { name: '本次会话允许首次创建' }).check();
    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: '首次创建' }).click();
    await expect(panel.getByRole('status')).toContainText('回读核验一致');

    const result = await page.evaluate(() => ({
        requests: window.__habitSyncRequests,
        uploaded: window.__habitUploaded,
        state: JSON.parse(localStorage.getItem('habitAppSyncState')),
        config: JSON.parse(localStorage.getItem('habitAppSyncConfig')),
        data: JSON.parse(localStorage.getItem('lifePlanData')),
    }));
    const fileRequests = result.requests.filter(item => item.url.includes('/apps/habit-app/data.json'));
    expect(fileRequests.map(item => item.method)).toEqual(['GET', 'GET', 'PUT', 'GET']);
    const put = fileRequests.find(item => item.method === 'PUT');
    expect(put.headers['If-None-Match'] || put.headers['if-none-match']).toBe('*');
    expect(result.uploaded.habits.some(item => item.title === '首次云端习惯' || item.name === '首次云端习惯')).toBe(true);
    expect(result.uploaded.habitRecords).toEqual(expect.arrayContaining([
        expect.objectContaining({ note: '首次创建打卡' }),
    ]));
    expect(result.data.habits[0].name).toBe('首次云端习惯');
    expect(result.state).toMatchObject({ dirty: false, lastRemoteEtag: '"habit-created"' });
    expect(result.state.lastLocalHash).toEqual(expect.any(String));
    expect(result.state.lastRemoteHash).toEqual(expect.any(String));
    expect(result.state.lastPushAt).toEqual(expect.any(String));
    expect(result.config).toMatchObject({ remotePath: '/apps/habit-app/data.json', autoSync: false, remoteUploadEnabled: false });
});

test('habit first remote creation stops before PUT when the file appears after preview', async ({ page }) => {
    const local = emptyData({
        habits: [{
            id: 'habit-first-race-local',
            name: '首次创建竞态本机习惯',
            rule: 'daily',
            timesPerDay: 1,
            rewardPoints: 1,
            rewardCurrency: '金币',
            createdAt: '2026-07-29T08:00:00',
            updatedAt: '2026-07-29T08:00:00',
        }],
    });
    const remoteAfter = habitRemoteSnapshot({
        habits: [{ id: 'life-plan/habits/habit-first-race-remote', title: '另一设备已创建习惯', updatedAt: '2026-07-29T09:00:00' }],
        habitCurrencies: [{ id: 'default', name: '金币' }],
    });
    const original = JSON.stringify(local);
    const syncState = JSON.stringify({ dirty: true, lastRemoteHash: 'old-first-race' });
    await page.addInitScript(({ localData, stateData, remoteData }) => {
        localStorage.setItem('lifePlanData', localData);
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('habitAppSyncState', stateData);
        window.__habitSyncRequests = [];
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__habitSyncRequests.push({ url: String(url), method, headers: options.headers || {}, body: options.body || '' });
            if (method === 'GET') {
                const count = window.__habitSyncRequests.filter(item => item.method === 'GET').length;
                if (count === 1) return new Response('missing', { status: 404 });
                return new Response(JSON.stringify(remoteData), { status: 200, headers: { ETag: '"habit-first-race-v2"', 'Content-Type': 'application/json' } });
            }
            return new Response('', { status: 405 });
        };
    }, { localData: original, stateData: syncState, remoteData: remoteAfter });

    await page.goto('/#/sync');
    const panel = page.locator('.habit-sync-card');
    await panel.getByRole('button', { name: '检查 Habit 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('不存在');
    await panel.getByRole('checkbox', { name: '本次会话允许首次创建' }).check();
    await panel.getByRole('button', { name: '首次创建' }).click();
    await expect(panel.getByRole('status')).toContainText('已停止首次创建');

    const result = await page.evaluate(() => ({
        requests: window.__habitSyncRequests,
        data: localStorage.getItem('lifePlanData'),
        syncState: localStorage.getItem('habitAppSyncState'),
        config: JSON.parse(localStorage.getItem('habitAppSyncConfig')),
    }));
    const fileRequests = result.requests.filter(item => item.url.includes('/apps/habit-app/data.json'));
    expect(fileRequests.map(item => item.method)).toEqual(['GET', 'GET']);
    expect(result.data).toBe(original);
    expect(result.syncState).toBe(syncState);
    expect(result.config).toMatchObject({ remotePath: '/apps/habit-app/data.json', autoSync: false, remoteUploadEnabled: false });
});

test('wheel remote preview stays GET-only and apply rechecks then persists the merged contract', async ({ page }) => {
    const local = emptyData({
        wheels: [{
            id: 'wheel-local-sync', name: '本机转盘', mode: 'normal',
            items: [{ id: 'local-option', name: '本机选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' }],
            createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00',
        }],
        wheelTags: [{ id: 'tag-local-sync', name: '本机标签', color: '#216e4e', weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' }],
        wheelLibraryItems: [{ id: 'library-local-sync', name: '本机公共项', note: '', tagIds: ['tag-local-sync'], weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' }],
        deletedItems: [{ collection: 'wheelLibraryItems', id: 'library-deleted-sync', deletedAt: '2026-07-28T08:30:00', reason: 'manual-delete' }],
    });
    const remote = {
        wheels: [{
            id: 'wheel-remote-sync', name: '云端转盘', mode: 'normal',
            items: [{ id: 'remote-option', name: '云端选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-28T09:00:00', updatedAt: '2026-07-28T09:00:00' }],
            createdAt: '2026-07-28T09:00:00', updatedAt: '2026-07-28T09:00:00',
        }],
        wheelTags: [{ id: 'tag-remote-sync', name: '云端标签', color: '#4f7cac', weight: 1, enabled: true, createdAt: '2026-07-28T09:00:00', updatedAt: '2026-07-28T09:00:00' }],
        wheelLibraryItems: [{ id: 'library-remote-sync', name: '云端公共项', note: '', tagIds: ['tag-remote-sync'], weight: 1, enabled: true, createdAt: '2026-07-28T09:00:00', updatedAt: '2026-07-28T09:00:00' }],
        wheelHistory: [{ id: 'history-remote-sync', wheelId: 'wheel-remote-sync', wheelName: '云端转盘', mode: 'normal', resultId: 'remote-option', resultName: '云端选项', note: '', convertedTodoId: '', createdAt: '2026-07-28T09:05:00', updatedAt: '2026-07-28T09:05:00' }],
        deletedItems: [{ collection: 'wheelHistory', id: 'history-deleted-sync', deletedAt: '2026-07-28T09:10:00', reason: 'manual-delete' }],
    };
    const original = JSON.stringify(local);
    await page.addInitScript(({ localData, remoteData }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: true }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({ remotePath: '/unsafe-wheel.json', autoSync: true, remoteUploadEnabled: true }));
        window.__wheelSyncRequests = [];
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__wheelSyncRequests.push({ url: String(url), method, headers: options.headers || {}, body: options.body || '' });
            if (method === 'GET') return new Response(JSON.stringify(remoteData), { status: 200, headers: { ETag: '"wheel-v1"', 'Content-Type': 'application/json' } });
            return new Response('', { status: 200 });
        };
    }, { localData: local, remoteData: remote });

    await page.goto('/#/sync');
    const panel = page.locator('.wheel-sync-card');
    await panel.getByRole('button', { name: '检查 Wheel 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('已生成');
    await expect(panel).toContainText('本机');
    await expect(panel).toContainText('云端');
    let state = await page.evaluate(() => ({
        data: localStorage.getItem('lifePlanData'),
        methods: window.__wheelSyncRequests.map(item => item.method),
        urls: window.__wheelSyncRequests.map(item => item.url),
        config: JSON.parse(localStorage.getItem('lifePlanWheelSyncConfig')),
        wheelState: JSON.parse(localStorage.getItem('lifePlanWheelSyncState')),
    }));
    expect(state.data).toBe(original);
    expect(state.methods).toEqual(['GET']);
    expect(state.urls[0]).toContain('/apps/wheel-app/data.json');
    expect(state.config).toMatchObject({ remotePath: '/apps/wheel-app/data.json', autoSync: false, remoteUploadEnabled: false });
    expect(state.wheelState.lastRemoteEtag).toBe('"wheel-v1"');

    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: '应用合并到本机' }).click();
    await expect(panel.getByRole('status')).toContainText('已应用');
    state = await page.evaluate(() => ({
        methods: window.__wheelSyncRequests.map(item => item.method),
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        wheelState: JSON.parse(localStorage.getItem('lifePlanWheelSyncState')),
        mainState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
        snapshots: JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'),
    }));
    expect(state.methods).toEqual(['GET', 'GET']);
    expect(state.data.wheels.map(item => item.id)).toEqual(expect.arrayContaining(['wheel-local-sync', 'wheel-remote-sync']));
    expect(state.data.wheelTags.map(item => item.id)).toEqual(expect.arrayContaining(['tag-local-sync', 'tag-remote-sync']));
    expect(state.data.wheelLibraryItems.map(item => item.id)).toEqual(expect.arrayContaining(['library-local-sync', 'library-remote-sync']));
    expect(state.data.wheelHistory.map(item => item.id)).toContain('history-remote-sync');
    expect(state.data.deletedItems.filter(item => item.collection === 'wheelHistory').map(item => item.id)).toContain('history-deleted-sync');
    expect(state.wheelState.dirty).toBe(true);
    expect(state.mainState.dirty).toBe(true);
    expect(state.snapshots.some(item => item.reason === '应用 Wheel 云端合并结果前')).toBe(true);
});

test('wheel remote apply stops before persistence when cloud changed after preview', async ({ page }) => {
    const local = emptyData({
        wheels: [{
            id: 'wheel-race-local', name: '竞态本机转盘', mode: 'normal',
            items: [{ id: 'race-local-option', name: '本机选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00' }],
            createdAt: '2026-07-28T08:00:00', updatedAt: '2026-07-28T08:00:00',
        }],
    });
    const remoteBefore = {
        wheels: [{
            id: 'wheel-race-remote', name: '预览云端转盘', mode: 'normal',
            items: [{ id: 'race-remote-option', name: '预览选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-28T09:00:00', updatedAt: '2026-07-28T09:00:00' }],
            createdAt: '2026-07-28T09:00:00', updatedAt: '2026-07-28T09:00:00',
        }],
        wheelTags: [], wheelLibraryItems: [], wheelHistory: [], deletedItems: [],
    };
    const remoteAfter = {
        ...remoteBefore,
        wheels: [
            ...remoteBefore.wheels,
            {
                id: 'wheel-race-new-cloud', name: '另一设备新增转盘', mode: 'normal',
                items: [{ id: 'race-new-option', name: '另一设备选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-28T10:00:00', updatedAt: '2026-07-28T10:00:00' }],
                createdAt: '2026-07-28T10:00:00', updatedAt: '2026-07-28T10:00:00',
            },
        ],
    };
    const original = JSON.stringify(local);
    await page.addInitScript(({ localData, firstRemote, secondRemote }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        window.__wheelSyncRequests = [];
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__wheelSyncRequests.push({ url: String(url), method, headers: options.headers || {}, body: options.body || '' });
            if (method === 'GET') {
                const getCount = window.__wheelSyncRequests.filter(item => item.method === 'GET').length;
                return new Response(JSON.stringify(getCount === 1 ? firstRemote : secondRemote), {
                    status: 200,
                    headers: { ETag: getCount === 1 ? '"wheel-race-v1"' : '"wheel-race-v2"', 'Content-Type': 'application/json' },
                });
            }
            return new Response('', { status: 200 });
        };
    }, { localData: local, firstRemote: remoteBefore, secondRemote: remoteAfter });

    await page.goto('/#/sync');
    const panel = page.locator('.wheel-sync-card');
    await panel.getByRole('button', { name: '检查 Wheel 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('已生成');
    await panel.getByRole('button', { name: '应用合并到本机' }).click();
    await expect(panel.getByRole('status')).toContainText('云端自预览后已变化');

    const result = await page.evaluate(() => ({
        data: localStorage.getItem('lifePlanData'),
        requests: window.__wheelSyncRequests,
        state: JSON.parse(localStorage.getItem('lifePlanWheelSyncState')),
        snapshots: JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'),
    }));
    expect(result.data).toBe(original);
    expect(result.requests.map(item => item.method)).toEqual(['GET', 'GET']);
    expect(result.requests.every(item => item.url.includes('/apps/wheel-app/data.json'))).toBe(true);
    expect(result.state.lastConflictAt).toBeTruthy();
    expect(result.state.lastRemoteEtag).toBe('"wheel-race-v2"');
    expect(result.snapshots.some(item => item.reason === '应用 Wheel 云端合并结果前')).toBe(false);
});

test('wheel existing remote upload uses If-Match and verifies the written snapshot', async ({ page }) => {
    const local = emptyData({
        wheels: [{
            id: 'wheel-existing-sync', name: '本机新版转盘', mode: 'normal',
            items: [{ id: 'existing-local-option', name: '本机新版选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T10:00:00' }],
            createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T10:00:00',
        }],
        wheelTags: [{ id: 'tag-existing-local', name: '本机标签', color: '#216e4e', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T10:00:00' }],
        wheelLibraryItems: [{ id: 'library-existing-local', name: '本机公共项', note: '', tagIds: ['tag-existing-local'], weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T10:00:00' }],
    });
    const remote = {
        wheels: [{
            id: 'wheel-existing-sync', name: '云端旧版转盘', mode: 'normal',
            items: [{ id: 'existing-remote-option', name: '云端旧版选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-29T07:00:00', updatedAt: '2026-07-29T08:00:00' }],
            createdAt: '2026-07-29T07:00:00', updatedAt: '2026-07-29T08:00:00',
        }],
        wheelTags: [], wheelLibraryItems: [], wheelHistory: [], deletedItems: [],
    };
    await page.addInitScript(({ localData, remoteData }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({ remotePath: '/unsafe-wheel.json', autoSync: true, remoteUploadEnabled: true }));
        window.__wheelSyncRequests = [];
        window.__wheelUploaded = null;
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__wheelSyncRequests.push({ url: String(url), method, headers: options.headers || {}, body: options.body || '' });
            if (method === 'PUT') {
                window.__wheelUploaded = JSON.parse(options.body);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ETag: '"wheel-existing-v2"' } });
            }
            if (method === 'GET') {
                const fileGets = window.__wheelSyncRequests.filter(item => item.method === 'GET').length;
                const body = fileGets >= 3 && window.__wheelUploaded ? window.__wheelUploaded : remoteData;
                return new Response(JSON.stringify(body), { status: 200, headers: { ETag: fileGets >= 3 ? '"wheel-existing-v2"' : '"wheel-existing-v1"', 'Content-Type': 'application/json' } });
            }
            return new Response('', { status: 200 });
        };
    }, { localData: local, remoteData: remote });

    await page.goto('/#/sync');
    const panel = page.locator('.wheel-sync-card');
    await panel.getByRole('button', { name: '检查 Wheel 云端' }).click();
    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: '受保护上传' }).click();
    await expect(panel.getByRole('status')).toContainText('回读核验一致');

    const result = await page.evaluate(() => ({
        requests: window.__wheelSyncRequests,
        uploaded: window.__wheelUploaded,
        state: JSON.parse(localStorage.getItem('lifePlanWheelSyncState')),
        config: JSON.parse(localStorage.getItem('lifePlanWheelSyncConfig')),
    }));
    const fileRequests = result.requests.filter(item => item.url.includes('/apps/wheel-app/data.json'));
    expect(fileRequests.map(item => item.method)).toEqual(['GET', 'GET', 'PUT', 'GET']);
    const put = fileRequests.find(item => item.method === 'PUT');
    expect(put.headers['If-Match'] || put.headers['if-match']).toBe('"wheel-existing-v1"');
    expect(result.uploaded.wheels[0].name).toBe('本机新版转盘');
    expect(result.uploaded.wheelLibraryItems.map(item => item.id)).toContain('library-existing-local');
    expect(result.state).toMatchObject({ dirty: false, lastRemoteEtag: '"wheel-existing-v2"' });
    expect(result.config).toMatchObject({ remotePath: '/apps/wheel-app/data.json', autoSync: false, remoteUploadEnabled: false });
});

test('wheel existing upload stops before PUT when the remote changed after preview', async ({ page }) => {
    const local = emptyData({
        wheels: [{
            id: 'wheel-upload-race-local', name: '上传竞态本机转盘', mode: 'normal',
            items: [{ id: 'upload-race-local-option', name: '本机选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T10:00:00' }],
            createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T10:00:00',
        }],
    });
    const remoteBefore = {
        wheels: [{ id: 'wheel-upload-race-remote', name: '预览云端转盘', mode: 'normal', items: [], createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
        wheelTags: [], wheelLibraryItems: [], wheelHistory: [], deletedItems: [],
    };
    const remoteAfter = {
        ...remoteBefore,
        wheelHistory: [{ id: 'wheel-upload-race-history', wheelId: 'wheel-upload-race-remote', wheelName: '预览云端转盘', mode: 'normal', resultId: '', resultName: '另一设备结果', note: '', createdAt: '2026-07-29T10:30:00', updatedAt: '2026-07-29T10:30:00' }],
    };
    await page.addInitScript(({ localData, firstRemote, secondRemote }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        window.__wheelSyncRequests = [];
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__wheelSyncRequests.push({ url: String(url), method, headers: options.headers || {} });
            if (method === 'GET') {
                const count = window.__wheelSyncRequests.filter(item => item.method === 'GET').length;
                return new Response(JSON.stringify(count === 1 ? firstRemote : secondRemote), {
                    status: 200,
                    headers: { ETag: count === 1 ? '"wheel-upload-race-v1"' : '"wheel-upload-race-v2"', 'Content-Type': 'application/json' },
                });
            }
            return new Response('', { status: 200 });
        };
    }, { localData: local, firstRemote: remoteBefore, secondRemote: remoteAfter });

    await page.goto('/#/sync');
    const panel = page.locator('.wheel-sync-card');
    await panel.getByRole('button', { name: '检查 Wheel 云端' }).click();
    await panel.getByRole('button', { name: '受保护上传' }).click();
    await expect(panel.getByRole('status')).toContainText('云端自上次检查后已变化');

    const result = await page.evaluate(() => ({
        methods: window.__wheelSyncRequests.map(item => item.method),
        state: JSON.parse(localStorage.getItem('lifePlanWheelSyncState')),
    }));
    expect(result.methods).toEqual(['GET', 'GET']);
    expect(result.state.lastConflictAt).toBeTruthy();
    expect(result.state.lastRemoteEtag).toBe('"wheel-upload-race-v2"');
});

test('wheel first remote creation requires session arm and uses If-None-Match', async ({ page }) => {
    const local = emptyData({
        wheels: [{
            id: 'wheel-first-sync', name: '首次云端转盘', mode: 'normal',
            items: [{ id: 'first-option', name: '首次选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00' }],
            createdAt: '2026-07-29T08:00:00', updatedAt: '2026-07-29T08:00:00',
        }],
    });
    await page.addInitScript(localData => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({ remotePath: '/unsafe-wheel.json', autoSync: true, remoteUploadEnabled: true }));
        window.__wheelSyncRequests = [];
        window.__wheelUploaded = null;
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__wheelSyncRequests.push({ url: String(url), method, headers: options.headers || {}, body: options.body || '' });
            if (method === 'PUT') {
                window.__wheelUploaded = JSON.parse(options.body);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ETag: '"wheel-created"' } });
            }
            if (method === 'GET') {
                if (!window.__wheelUploaded) return new Response('missing', { status: 404 });
                return new Response(JSON.stringify(window.__wheelUploaded), { status: 200, headers: { ETag: '"wheel-created"', 'Content-Type': 'application/json' } });
            }
            return new Response('', { status: 200 });
        };
    }, local);

    await page.goto('/#/sync');
    const panel = page.locator('.wheel-sync-card');
    await panel.getByRole('button', { name: '检查 Wheel 云端' }).click();
    await expect(panel.getByRole('status')).toContainText('不存在');
    await expect(panel.getByRole('checkbox', { name: '本次会话允许首次创建' })).not.toBeChecked();
    expect(await page.evaluate(() => window.__wheelSyncRequests.filter(item => item.method === 'PUT').length)).toBe(0);
    await panel.getByRole('checkbox', { name: '本次会话允许首次创建' }).check();
    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: '首次创建' }).click();
    await expect(panel.getByRole('status')).toContainText('回读核验一致');

    const result = await page.evaluate(() => ({
        requests: window.__wheelSyncRequests,
        state: JSON.parse(localStorage.getItem('lifePlanWheelSyncState')),
        config: JSON.parse(localStorage.getItem('lifePlanWheelSyncConfig')),
    }));
    const fileRequests = result.requests.filter(item => item.url.includes('/apps/wheel-app/data.json'));
    expect(fileRequests.map(item => item.method)).toEqual(['GET', 'GET', 'PUT', 'GET']);
    const put = fileRequests.find(item => item.method === 'PUT');
    expect(put.headers['If-None-Match'] || put.headers['if-none-match']).toBe('*');
    expect(result.state).toMatchObject({ dirty: false, lastRemoteEtag: '"wheel-created"' });
    expect(result.config).toMatchObject({ remotePath: '/apps/wheel-app/data.json', autoSync: false, remoteUploadEnabled: false });
});

test('wheel conditional auto sync sanitizes old config and stays idle when disabled', async ({ page }) => {
    const local = emptyData({
        wheels: [{
            id: 'wheel-auto-idle', name: '自动同步关闭转盘', mode: 'normal',
            items: [{ id: 'idle-option', name: '旧选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-30T08:00:00', updatedAt: '2026-07-30T08:00:00' }],
            createdAt: '2026-07-30T08:00:00', updatedAt: '2026-07-30T08:00:00',
        }],
    });
    await page.addInitScript(localData => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({ remotePath: '/unsafe-wheel.json', autoSync: true, remoteUploadEnabled: true }));
        window.__wheelAutoRequests = [];
        window.fetch = async (url, options = {}) => {
            window.__wheelAutoRequests.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body || '' });
            return new Response('missing', { status: 404 });
        };
    }, local);

    await page.clock.install();
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();
    await page.locator('.wheel-stage-card').getByRole('button', { name: '编辑当前' }).click();
    await page.getByLabel('选项名称').fill('关闭时新增选项');
    await page.locator('.option-form').getByRole('button', { name: '添加' }).click();
    await page.clock.fastForward(25000);
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => ({
        requests: window.__wheelAutoRequests,
        config: JSON.parse(localStorage.getItem('lifePlanWheelSyncConfig')),
        state: JSON.parse(localStorage.getItem('lifePlanWheelSyncState') || '{}'),
    }));
    expect(result.requests).toEqual([]);
    expect(result.config).toMatchObject({
        remotePath: '/apps/wheel-app/data.json',
        autoSync: false,
        conditionalAutoSyncEnabled: false,
        remoteUploadEnabled: false,
    });
    expect(result.state.dirty).toBe(true);
});

test('wheel conditional auto sync uploads dirty wheel slice after debounce', async ({ page }) => {
    const local = emptyData({
        wheels: [{
            id: 'wheel-auto-upload', name: '自动上传转盘', mode: 'normal',
            items: [{ id: 'auto-upload-old', name: '旧选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-30T08:00:00', updatedAt: '2026-07-30T08:00:00' }],
            createdAt: '2026-07-30T08:00:00', updatedAt: '2026-07-30T08:00:00',
        }],
    });
    await page.addInitScript(localData => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({
            remotePath: '/apps/wheel-app/data.json',
            autoSync: true,
            conditionalAutoSyncEnabled: true,
            remoteUploadEnabled: true,
        }));
        window.__wheelAutoRequests = [];
        window.__wheelUploaded = null;
        window.fetch = async (url, options = {}) => {
            const method = options.method || 'GET';
            window.__wheelAutoRequests.push({ url: String(url), method, headers: options.headers || {}, body: options.body || '' });
            if (method === 'PUT') {
                window.__wheelUploaded = JSON.parse(options.body);
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ETag: '"wheel-auto-v2"' } });
            }
            if (method === 'GET') {
                const body = window.__wheelUploaded || localData;
                return new Response(JSON.stringify(body), { status: 200, headers: { ETag: window.__wheelUploaded ? '"wheel-auto-v2"' : '"wheel-auto-v1"', 'Content-Type': 'application/json' } });
            }
            return new Response('', { status: 200 });
        };
    }, local);

    await page.clock.install();
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();
    await page.locator('.wheel-stage-card').getByRole('button', { name: '编辑当前' }).click();
    const baselineHash = await page.evaluate(localData => {
        const sync = window.LifePlanSyncService.create();
        return sync.getWheelDataHash(sync.getWheelSnapshot(localData));
    }, local);
    await page.evaluate(hash => {
        localStorage.setItem('lifePlanWheelSyncState', JSON.stringify({
            dirty: false,
            lastLocalHash: hash,
            lastRemoteHash: hash,
            lastRemoteEtag: '"wheel-auto-v1"',
        }));
    }, baselineHash);
    await page.getByLabel('选项名称').fill('自动同步新增选项');
    await page.locator('.option-form').getByRole('button', { name: '添加' }).click();
    await page.clock.fastForward(20000);
    await expect.poll(() => page.evaluate(() => window.__wheelAutoRequests.filter(item => item.method === 'PUT').length)).toBe(1);

    const result = await page.evaluate(() => ({
        requests: window.__wheelAutoRequests,
        uploaded: window.__wheelUploaded,
        wheelState: JSON.parse(localStorage.getItem('lifePlanWheelSyncState')),
        mainState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
        config: JSON.parse(localStorage.getItem('lifePlanWheelSyncConfig')),
    }));
    const fileRequests = result.requests.filter(item => item.url.includes('/apps/wheel-app/data.json'));
    expect(fileRequests.map(item => item.method)).toEqual(['GET', 'PUT', 'GET']);
    const put = fileRequests.find(item => item.method === 'PUT');
    expect(put.headers['If-Match'] || put.headers['if-match']).toBe('"wheel-auto-v1"');
    expect(result.uploaded.wheels[0].items.map(item => item.name)).toContain('自动同步新增选项');
    expect(result.uploaded.remoteUploadEnabled).toBeUndefined();
    expect(result.wheelState).toMatchObject({ dirty: false, lastRemoteEtag: '"wheel-auto-v2"' });
    expect(result.mainState.dirty).toBe(true);
    expect(result.config).toMatchObject({ remotePath: '/apps/wheel-app/data.json', autoSync: true, conditionalAutoSyncEnabled: true, remoteUploadEnabled: false });
});

test('wheel conditional auto sync never creates a missing remote file', async ({ page }) => {
    const local = emptyData({
        wheels: [{
            id: 'wheel-auto-missing', name: '自动同步缺云端', mode: 'normal',
            items: [{ id: 'missing-option', name: '旧选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-30T08:00:00', updatedAt: '2026-07-30T08:00:00' }],
            createdAt: '2026-07-30T08:00:00', updatedAt: '2026-07-30T08:00:00',
        }],
    });
    await page.addInitScript(localData => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({
            remotePath: '/apps/wheel-app/data.json',
            autoSync: true,
            conditionalAutoSyncEnabled: true,
            remoteUploadEnabled: false,
        }));
        window.__wheelAutoRequests = [];
        window.fetch = async (url, options = {}) => {
            window.__wheelAutoRequests.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body || '' });
            return new Response('missing', { status: 404 });
        };
    }, local);

    await page.clock.install();
    await page.goto('/#/wheel');
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();
    await page.locator('.wheel-stage-card').getByRole('button', { name: '编辑当前' }).click();
    await page.getByLabel('选项名称').fill('缺云端时新增选项');
    await page.locator('.option-form').getByRole('button', { name: '添加' }).click();
    await page.clock.fastForward(20000);
    await expect.poll(() => page.evaluate(() => window.__wheelAutoRequests.filter(item => item.method === 'GET').length)).toBe(1);
    const result = await page.evaluate(() => ({
        methods: window.__wheelAutoRequests.map(item => item.method),
        headers: window.__wheelAutoRequests.map(item => item.headers),
        state: JSON.parse(localStorage.getItem('lifePlanWheelSyncState')),
    }));
    expect(result.methods).toEqual(['GET']);
    expect(result.headers.some(headers => headers['If-None-Match'] || headers['if-none-match'])).toBe(false);
    expect(result.state.dirty).toBe(true);
});

test('wheel conditional auto sync pulls remote update on visibility resume', async ({ page }) => {
    const local = emptyData({
        wheels: [{
            id: 'wheel-visible-local', name: '可见性本机转盘', mode: 'normal',
            items: [{ id: 'visible-local-option', name: '本机选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-30T08:00:00', updatedAt: '2026-07-30T08:00:00' }],
            createdAt: '2026-07-30T08:00:00', updatedAt: '2026-07-30T08:00:00',
        }],
    });
    const remote = emptyData({
        wheels: [{
            id: 'wheel-visible-remote', name: '可见性云端转盘', mode: 'normal',
            items: [{ id: 'visible-remote-option', name: '云端选项', note: '', weight: 1, enabled: true, createdAt: '2026-07-30T09:00:00', updatedAt: '2026-07-30T09:00:00' }],
            createdAt: '2026-07-30T09:00:00', updatedAt: '2026-07-30T09:00:00',
        }],
    });
    await page.addInitScript(({ localData, remoteData }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({
            remotePath: '/apps/wheel-app/data.json',
            autoSync: true,
            conditionalAutoSyncEnabled: true,
            remoteUploadEnabled: false,
        }));
        window.__wheelAutoRequests = [];
        window.__wheelRemote = remoteData;
        window.fetch = async (url, options = {}) => {
            window.__wheelAutoRequests.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body || '' });
            return new Response(JSON.stringify(window.__wheelRemote), { status: 200, headers: { ETag: '"wheel-visible-v2"', 'Content-Type': 'application/json' } });
        };
    }, { localData: local, remoteData: remote });

    await page.goto('/#/sync');
    const localHash = await page.evaluate(localData => {
        const sync = window.LifePlanSyncService.create();
        return sync.getWheelDataHash(sync.getWheelSnapshot(localData));
    }, local);
    await page.evaluate(hash => {
        localStorage.setItem('lifePlanWheelSyncState', JSON.stringify({
            dirty: false,
            lastLocalHash: hash,
            lastRemoteHash: hash,
            lastRemoteEtag: '"wheel-visible-v1"',
        }));
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new Event('visibilitychange'));
    }, localHash);
    await expect.poll(() => page.evaluate(() => window.__wheelAutoRequests.filter(item => item.method === 'GET').length)).toBeGreaterThan(0);

    const result = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData')),
        wheelState: JSON.parse(localStorage.getItem('lifePlanWheelSyncState')),
        mainState: JSON.parse(localStorage.getItem('lifePlanSyncState')),
        methods: window.__wheelAutoRequests.map(item => item.method),
    }));
    expect(result.methods).toEqual(['GET']);
    expect(result.data.wheels.map(item => item.id)).toEqual(['wheel-visible-remote']);
    expect(result.wheelState).toMatchObject({ dirty: false, lastRemoteEtag: '"wheel-visible-v2"' });
    expect(result.mainState.dirty).toBe(true);
});

test('habit conditional auto sync sanitizes old config and stays idle when disabled', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const local = emptyData({
        habits: [{ id: 'habit-auto-idle', name: '自动同步关闭习惯', rule: 'daily', timesPerDay: '2', rewardPoints: 1, rewardCurrency: '金币', startDate: today }],
    });
    const requests = [];
    await page.route('https://habit-auto-idle.example.test/**', async route => {
        requests.push(route.request().method());
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(habitRemoteSnapshot()) });
    });
    await page.addInitScript(localData => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://habit-auto-idle.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('habitAppSyncConfig', JSON.stringify({ remotePath: '/unsafe-habit.json', autoSync: true, remoteUploadEnabled: true }));
    }, local);

    await page.clock.install();
    await page.goto('/#/habits');
    await page.getByRole('button', { name: '打卡', exact: true }).click();
    await page.clock.fastForward(25000);
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => ({
        config: JSON.parse(localStorage.getItem('habitAppSyncConfig') || '{}'),
        state: JSON.parse(localStorage.getItem('habitAppSyncState') || '{}'),
    }));
    expect(requests).toEqual([]);
    expect(result.config).toMatchObject({
        remotePath: '/apps/habit-app/data.json',
        autoSync: false,
        conditionalAutoSyncEnabled: false,
        remoteUploadEnabled: false,
    });
    expect(result.state.dirty).toBe(true);
});

test('habit conditional auto sync uploads dirty habit slice after debounce', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const local = emptyData({
        habits: [{
            id: 'habit-auto-upload',
            name: '自动上传习惯',
            tag: '健康',
            rule: 'daily',
            timesPerDay: '2',
            rewardPoints: 3,
            rewardCurrency: '金币',
            startDate: today,
            createdAt: `${today}T08:00:00`,
            updatedAt: `${today}T08:00:00`,
        }],
        habitCurrencies: [{ id: 'currency-coin', name: '金币' }],
    });
    const remote = habitRemoteSnapshot({
        habits: [{ id: 'life-plan/habits/habit-auto-upload', title: '自动上传习惯', rewardAmount: 3, rewardCurrencyId: 'default', updatedAt: `${today}T08:00:00` }],
        habitCurrencies: [{ id: 'default', name: '金币' }],
    });
    const requests = [];
    let uploaded = null;
    await page.route('https://habit-auto-upload.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        requests.push({ method: request.method(), path: url.pathname, headers: request.headers(), body: request.postData() || '' });
        if (request.method() === 'GET' && url.pathname === '/apps/habit-app/data.json') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { ETag: uploaded ? '"habit-auto-v2"' : '"habit-auto-v1"', 'Access-Control-Expose-Headers': 'ETag' },
                body: JSON.stringify(uploaded || remote),
            });
            return;
        }
        if (request.method() === 'PUT' && url.pathname === '/apps/habit-app/data.json') {
            uploaded = JSON.parse(request.postData() || 'null');
            await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"habit-auto-v2"', 'Access-Control-Expose-Headers': 'ETag' }, body: JSON.stringify({ ok: true }) });
            return;
        }
        await route.fulfill({ status: 405, body: '' });
    });
    await page.addInitScript(({ localData }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://habit-auto-upload.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('habitAppSyncConfig', JSON.stringify({
            remotePath: '/apps/habit-app/data.json',
            autoSync: true,
            conditionalAutoSyncEnabled: true,
            remoteUploadEnabled: false,
        }));
    }, { localData: local });

    await page.clock.install();
    await page.goto('/#/habits');
    const hashes = await page.evaluate(remoteData => {
        const services = window.LifePlanSyncService.create();
        const habit = window.LifePlanHabitService.create();
        const data = JSON.parse(localStorage.getItem('lifePlanData'));
        return {
            localSourceHash: services.getDataHash(habit.getHabitLegacySourceSlice(data)),
            remoteHash: services.getHabitDataHash(remoteData),
        };
    }, remote);
    await page.evaluate(({ localSourceHash, remoteHash }) => {
        localStorage.setItem('habitAppSyncState', JSON.stringify({
            dirty: false,
            lastLocalHash: localSourceHash,
            lastRemoteHash: remoteHash,
            lastRemoteEtag: '"habit-auto-v1"',
        }));
    }, hashes);
    await page.getByRole('button', { name: '打卡', exact: true }).click();
    await page.clock.fastForward(20000);
    await expect.poll(() => requests.filter(item => item.method === 'PUT').length).toBe(1);

    const result = await page.evaluate(() => ({
        uploaded: window.__unused || null,
        habitState: JSON.parse(localStorage.getItem('habitAppSyncState') || '{}'),
        mainState: JSON.parse(localStorage.getItem('lifePlanSyncState') || '{}'),
        config: JSON.parse(localStorage.getItem('habitAppSyncConfig') || '{}'),
    }));
    const fileRequests = requests.filter(item => item.path === '/apps/habit-app/data.json');
    const put = fileRequests.find(item => item.method === 'PUT');
    expect(fileRequests.map(item => item.method)).toEqual(['GET', 'PUT', 'GET']);
    expect(put.headers['if-match'] || put.headers['If-Match']).toBe('"habit-auto-v1"');
    expect(uploaded.habitRecords.length).toBeGreaterThan(0);
    expect(uploaded.localMirror).toBeUndefined();
    expect(uploaded.remoteUploadEnabled).toBeUndefined();
    expect(result.habitState).toMatchObject({ dirty: false, lastRemoteEtag: '"habit-auto-v2"' });
    expect(result.mainState.dirty).toBe(true);
    expect(result.config).toMatchObject({ remotePath: '/apps/habit-app/data.json', autoSync: true, conditionalAutoSyncEnabled: true, remoteUploadEnabled: false });
});

test('habit conditional auto sync never creates a missing remote file', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const local = emptyData({
        habits: [{ id: 'habit-auto-missing', name: '自动同步不首创习惯', rule: 'daily', timesPerDay: '2', rewardPoints: 1, rewardCurrency: '金币', startDate: today }],
    });
    const requests = [];
    await page.route('https://habit-auto-missing.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        requests.push({ method: request.method(), path: url.pathname, headers: request.headers() });
        if (request.method() === 'GET' && url.pathname === '/apps/habit-app/data.json') {
            await route.fulfill({ status: 404, body: '' });
            return;
        }
        await route.fulfill({ status: 405, body: '' });
    });
    await page.addInitScript(localData => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://habit-auto-missing.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('habitAppSyncConfig', JSON.stringify({
            remotePath: '/apps/habit-app/data.json',
            autoSync: true,
            conditionalAutoSyncEnabled: true,
            remoteUploadEnabled: false,
        }));
    }, local);

    await page.clock.install();
    await page.goto('/#/habits');
    await page.getByRole('button', { name: '打卡', exact: true }).click();
    await page.clock.fastForward(20000);
    await expect.poll(() => requests.filter(item => item.path === '/apps/habit-app/data.json').length).toBe(1);

    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('habitAppSyncState') || '{}'));
    expect(requests.map(item => item.method)).toEqual(['GET']);
    expect(requests.some(item => item.headers['if-none-match'] || item.headers['If-None-Match'])).toBe(false);
    expect(state.dirty).toBe(true);
});

test('habit conditional auto sync pulls remote update on visibility resume', async ({ page }) => {
    const remote = habitRemoteSnapshot({
        habits: [{ id: 'life-plan/habits/habit-auto-remote', title: '自动拉取云端习惯', repeatUnit: 'daily', requiredCountPerDay: 1, rewardAmount: 2, rewardCurrencyId: 'default', createdAt: '2026-07-30T08:00:00', updatedAt: '2026-07-30T08:00:00' }],
        habitRecords: [{ id: 'life-plan/checkins/checkin-auto-remote', habitId: 'life-plan/habits/habit-auto-remote', recordDate: '2026-07-30', recordTime: '2026-07-30T08:10:00', note: '云端打卡', createdAt: '2026-07-30T08:10:00', updatedAt: '2026-07-30T08:10:00' }],
        habitLedger: [{ id: 'life-plan/ledger/ledger-auto-remote', type: 'checkin', habitId: 'life-plan/habits/habit-auto-remote', sourceId: 'life-plan/checkins/checkin-auto-remote', amount: 2, currencyId: 'default', date: '2026-07-30', createdAt: '2026-07-30T08:10:00', updatedAt: '2026-07-30T08:10:00' }],
        habitCurrencies: [{ id: 'default', name: '金币' }],
    });
    const requests = [];
    let uploaded = null;
    await page.route('https://habit-auto-pull.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        requests.push({ method: request.method(), path: url.pathname, headers: request.headers(), body: request.postData() || '' });
        if (request.method() === 'GET' && url.pathname === '/apps/habit-app/data.json') {
            await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: uploaded ? '"habit-auto-pull-v2"' : '"habit-auto-pull-v1"', 'Access-Control-Expose-Headers': 'ETag' }, body: JSON.stringify(uploaded || remote) });
            return;
        }
        if (request.method() === 'PUT' && url.pathname === '/apps/habit-app/data.json') {
            uploaded = JSON.parse(request.postData() || 'null');
            await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"habit-auto-pull-v2"', 'Access-Control-Expose-Headers': 'ETag' }, body: JSON.stringify({ ok: true }) });
            return;
        }
        await route.fulfill({ status: 405, body: '' });
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://habit-auto-pull.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false }));
        localStorage.setItem('habitAppSyncConfig', JSON.stringify({
            remotePath: '/apps/habit-app/data.json',
            autoSync: true,
            conditionalAutoSyncEnabled: true,
            remoteUploadEnabled: false,
        }));
    }, emptyData());

    await page.goto('/#/sync');
    await page.evaluate(() => {
        localStorage.setItem('habitAppSyncState', JSON.stringify({
            dirty: false,
            lastRemoteHash: 'stale-empty-habit-baseline',
            lastRemoteEtag: '"habit-auto-pull-v0"',
        }));
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData') || '{}').habits.map(item => item.name))).toEqual(['自动拉取云端习惯']);
    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData') || '{}'),
        mirror: JSON.parse(localStorage.getItem('habitAppData') || 'null'),
        mainState: JSON.parse(localStorage.getItem('lifePlanSyncState') || '{}'),
        habitState: JSON.parse(localStorage.getItem('habitAppSyncState') || '{}'),
    }));
    const fileRequests = requests.filter(item => item.path === '/apps/habit-app/data.json');
    expect(fileRequests.some(item => item.method === 'GET')).toBe(true);
    expect(fileRequests.some(item => item.headers['if-none-match'] || item.headers['If-None-Match'])).toBe(false);
    expect(stored.data.checkins).toEqual(expect.arrayContaining([expect.objectContaining({ note: '云端打卡' })]));
    expect(stored.data.habitPointLedger).toEqual(expect.arrayContaining([expect.objectContaining({ amount: 2, currency: '金币' })]));
    expect(stored.mirror.localMirror).toBe(true);
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mainState.dirty).toBe(true);
    expect(stored.habitState.lastRemoteEtag).toMatch(/^"habit-auto-pull-v/);
});

test('todo existing remote upload uses If-Match and verifies the written mirror', async ({ page }) => {
    const local = emptyData({ todos: [todoFixture('todo-existing-sync', '本机新版待办', { updatedAt: '2026-07-27T10:00:00' })] });
    const remote = todoRemoteSnapshot([todoFixture('todo-existing-sync', '云端旧版待办', { updatedAt: '2026-07-27T08:00:00' })]);
    await page.addInitScript(({ localData, remoteData }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(localData));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
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
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
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
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://sync.example.test', remotePath: '/life-plan.json', autoSync: false }));
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

test('todo independent auto sync stays idle for stale unsafe config', async ({ page }) => {
    const source = emptyData({ todos: [todoFixture('todo-auto-idle', '不应自动同步')] });
    const methods = [];
    await page.route('https://todo-auto-idle.example.test/**', async route => {
        methods.push(route.request().method());
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(todoRemoteSnapshot([])) });
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://todo-auto-idle.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('todoAppSyncConfig', JSON.stringify({ remotePath: '/unsafe-todo.json', autoSync: true, remoteUploadEnabled: true }));
    }, source);

    await page.clock.install();
    await page.goto('/#/todos');
    await page.getByRole('button', { name: /新建.*待办/ }).click();
    await page.locator('#page-todos input[required]').fill('禁用状态编辑');
    await page.getByRole('button', { name: '保存待办' }).click();
    await page.clock.fastForward(25000);
    await page.waitForTimeout(100);

    const config = await page.evaluate(() => JSON.parse(localStorage.getItem('todoAppSyncConfig') || '{}'));
    expect(methods).toEqual([]);
    expect(config).toMatchObject({ remotePath: '/apps/todo-app/data.json', autoSync: false, remoteUploadEnabled: false });
});

test('todo independent auto sync records baseline before first remote difference', async ({ page }) => {
    const local = emptyData();
    const remote = todoRemoteSnapshot([todoFixture('todo-auto-first-remote', '首次差异不自动合并', { updatedAt: '2026-07-27T09:30:00' })]);
    const methods = [];
    await page.route('https://todo-auto-baseline.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        methods.push(`${request.method()} ${url.pathname}`);
        if (request.method() === 'GET' && url.pathname === '/apps/todo-app/data.json') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { ETag: '"todo-auto-first"', 'Access-Control-Expose-Headers': 'ETag, X-Remote-ETag' },
                body: JSON.stringify(remote),
            });
            return;
        }
        await route.fulfill({ status: 405, body: '' });
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://todo-auto-baseline.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('todoAppSyncConfig', JSON.stringify({ remotePath: '/apps/todo-app/data.json', autoSync: true, autoSyncUserEnabled: true, remoteUploadEnabled: false }));
    }, local);

    await page.goto('/#/sync');
    await page.locator('.todo-sync-card').getByRole('button', { name: '立即同步一次' }).click();

    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('todoAppSyncState') || '{}').lastRemoteHash || '')).not.toBe('');
    const stored = await page.evaluate(() => ({
        data: JSON.parse(localStorage.getItem('lifePlanData') || '{}'),
        state: JSON.parse(localStorage.getItem('todoAppSyncState') || '{}'),
        mainState: JSON.parse(localStorage.getItem('lifePlanSyncState') || '{}'),
    }));
    expect(methods).toEqual(['GET /apps/todo-app/data.json']);
    expect(stored.data.todos).toEqual([]);
    expect(stored.state).toMatchObject({ lastRemoteEtag: '"todo-auto-first"' });
    expect(stored.state.lastRemoteHash).toBeTruthy();
    expect(stored.mainState.dirty).not.toBe(true);
});

test('todo independent auto sync uploads local dirty data with If-Match and verifies', async ({ page }) => {
    const local = emptyData({ todos: [todoFixture('todo-auto-base', '自动同步基线')] });
    const remote = todoRemoteSnapshot([todoFixture('todo-auto-base', '自动同步基线')]);
    const requests = [];
    let uploaded = null;
    await page.route('https://todo-auto-upload.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        requests.push({ method: request.method(), path: url.pathname, headers: request.headers(), body: request.postData() || '' });
        if (request.method() === 'GET' && url.pathname === '/apps/todo-app/data.json') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { ETag: uploaded ? '"todo-auto-v2"' : '"todo-auto-v1"', 'Access-Control-Expose-Headers': 'ETag, X-Remote-ETag' },
                body: JSON.stringify(uploaded || remote),
            });
            return;
        }
        if (request.method() === 'PUT' && url.pathname === '/apps/todo-app/data.json') {
            uploaded = JSON.parse(request.postData() || 'null');
            await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"todo-auto-v2"', 'Access-Control-Expose-Headers': 'ETag, X-Remote-ETag' }, body: JSON.stringify({ ok: true }) });
            return;
        }
        await route.fulfill({ status: 405, body: '' });
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://todo-auto-upload.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('todoAppSyncConfig', JSON.stringify({ remotePath: '/apps/todo-app/data.json', autoSync: true, autoSyncUserEnabled: true, remoteUploadEnabled: false }));
        localStorage.setItem('todoAppSyncState', JSON.stringify({ dirty: false }));
    }, local);

    await page.goto('/#/todos');
    const hashes = await page.evaluate(remoteData => {
        const sync = window.LifePlanSyncService.create();
        const todos = window.LifePlanTodosService.create();
        const data = JSON.parse(localStorage.getItem('lifePlanData') || '{}');
        return {
            localSourceHash: sync.getDataHash({ todos: data.todos, deletedItems: data.deletedItems.filter(item => item.collection === 'todos') }),
            remoteHash: sync.getDataHash(todos.getTodoAppHashPayload(remoteData)),
        };
    }, remote);
    await page.evaluate(({ localSourceHash, remoteHash }) => {
        localStorage.setItem('todoAppSyncState', JSON.stringify({
            dirty: false,
            lastLocalHash: localSourceHash,
            lastRemoteHash: remoteHash,
            lastRemoteEtag: '"todo-auto-v1"',
        }));
    }, hashes);
    await page.getByRole('button', { name: /新建.*待办/ }).click();
    await page.locator('#page-todos input[required]').fill('自动同步新增待办');
    await page.getByRole('button', { name: '保存待办' }).click();
    await page.goto('/#/sync');
    await page.locator('.todo-sync-card').getByRole('button', { name: '立即同步一次' }).click();

    await expect.poll(() => requests.filter(item => item.method === 'PUT').length).toBe(1);
    const todoRequests = requests.filter(item => item.path === '/apps/todo-app/data.json');
    const put = todoRequests.find(item => item.method === 'PUT');
    expect(todoRequests.map(item => item.method)).toEqual(['GET', 'PUT', 'GET']);
    expect(put.headers['if-match'] || put.headers['If-Match']).toBe('"todo-auto-v1"');
    expect(uploaded.todos.map(item => item.text)).toEqual(expect.arrayContaining(['自动同步基线', '自动同步新增待办']));
    expect(uploaded.localMirror).toBeUndefined();
    expect(uploaded.remoteUploadEnabled).toBeUndefined();
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('todoAppSyncState') || '{}'));
    expect(state).toMatchObject({ dirty: false, lastRemoteEtag: '"todo-auto-v2"' });
});

test('todo independent auto sync applies remote merge to lifePlanData and marks main dirty', async ({ page }) => {
    const local = emptyData();
    const remote = todoRemoteSnapshot([todoFixture('todo-auto-remote', '自动拉取云端待办', { updatedAt: '2026-07-27T09:30:00' })]);
    const methods = [];
    await page.route('https://todo-auto-pull.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        methods.push(`${request.method()} ${url.pathname}`);
        if (request.method() === 'GET' && url.pathname === '/apps/todo-app/data.json') {
            await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"todo-auto-remote"' }, body: JSON.stringify(remote) });
            return;
        }
        await route.fulfill({ status: 405, body: '' });
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://todo-auto-pull.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false }));
        localStorage.setItem('todoAppSyncConfig', JSON.stringify({ remotePath: '/apps/todo-app/data.json', autoSync: true, autoSyncUserEnabled: true, remoteUploadEnabled: false }));
        localStorage.setItem('todoAppSyncState', JSON.stringify({ dirty: false, lastRemoteHash: 'stale-todo-baseline', lastRemoteEtag: '"todo-old"' }));
    }, local);

    await page.goto('/#/sync');
    await page.locator('.todo-sync-card').getByRole('button', { name: '立即同步一次' }).click();

    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData') || '{}').todos.map(item => item.text))).toEqual(['自动拉取云端待办']);
    const stored = await page.evaluate(() => ({
        mirror: JSON.parse(localStorage.getItem('todoAppData') || 'null'),
        mainState: JSON.parse(localStorage.getItem('lifePlanSyncState') || '{}'),
        todoState: JSON.parse(localStorage.getItem('todoAppSyncState') || '{}'),
    }));
    expect(methods).toEqual(['GET /apps/todo-app/data.json']);
    expect(stored.mirror.authority).toBe('lifePlanData.todos');
    expect(stored.mirror.remoteUploadEnabled).toBe(false);
    expect(stored.mainState.dirty).toBe(true);
    expect(stored.todoState.dirty).toBe(false);
});

test('todo independent auto sync never creates a missing remote file', async ({ page }) => {
    const source = emptyData({ todos: [todoFixture('todo-auto-missing', '自动同步不首次创建')] });
    const requests = [];
    await page.route('https://todo-auto-missing.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        requests.push({ method: request.method(), path: url.pathname });
        if (request.method() === 'GET' && url.pathname === '/apps/todo-app/data.json') {
            await route.fulfill({ status: 404, body: '' });
            return;
        }
        await route.fulfill({ status: 405, body: '' });
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({ webdavUrl: 'https://todo-auto-missing.example.test', remotePath: '/life-plan.json', autoSync: false }));
        localStorage.setItem('todoAppSyncConfig', JSON.stringify({ remotePath: '/apps/todo-app/data.json', autoSync: true, autoSyncUserEnabled: true, remoteUploadEnabled: false }));
    }, source);

    await page.clock.install();
    await page.goto('/#/todos');
    await page.getByRole('button', { name: /新建.*待办/ }).click();
    await page.locator('#page-todos input[required]').fill('缺失云端后仍不创建');
    await page.getByRole('button', { name: '保存待办' }).click();
    await page.clock.fastForward(20000);
    await expect.poll(() => requests.filter(item => item.path === '/apps/todo-app/data.json').length).toBe(1);

    expect(requests.filter(item => item.method === 'PUT')).toHaveLength(0);
    const config = await page.evaluate(() => JSON.parse(localStorage.getItem('todoAppSyncConfig') || '{}'));
    expect(config).toMatchObject({ remotePath: '/apps/todo-app/data.json', autoSync: true, remoteUploadEnabled: false });
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


test('main auto sync uploads local dirty data after the debounce window', async ({ page }) => {
    const source = emptyData({
        todos: [todoFixture('todo-auto', '自动同步待办')],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
            webdavUrl: 'https://example.test/dav',
            remotePath: '/life-plan.json',
            autoSync: true,
        }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({
            dirty: false,
            lastRemoteEtag: '"etag-1"',
        }));
    }, source);

    const calls = [];
    await page.route('https://example.test/dav/life-plan.json', async route => {
        const request = route.request();
        calls.push({ method: request.method(), ifMatch: request.headers()['if-match'] || '' });
        if (request.method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { ETag: '"etag-1"' },
                body: JSON.stringify(source),
            });
            return;
        }
        if (request.method() === 'PUT') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { ETag: '"etag-2"' },
                body: JSON.stringify({ ok: true, etag: '"etag-2"' }),
            });
            return;
        }
        await route.fallback();
    });

    await page.clock.install();
    await page.goto('/#/todos');
    // Allow startup auto-sync (if any) to settle with a clean, non-dirty local state.
    await page.waitForTimeout(200);
    const putsBeforeEdit = calls.filter(item => item.method === 'PUT').length;
    await page.getByRole('button', { name: /新建.*待办/ }).click();
    await page.locator('#page-todos input[required]').fill('触发自动同步');
    await page.getByRole('button', { name: '保存待办' }).click();
    await expect(page.locator('.todo-table')).toContainText('触发自动同步');
    expect(calls.filter(item => item.method === 'PUT')).toHaveLength(putsBeforeEdit);

    await page.clock.fastForward(20000);
    await expect.poll(() => calls.filter(item => item.method === 'PUT').length).toBe(putsBeforeEdit + 1);
    expect(calls.some(item => item.method === 'GET')).toBe(true);
    expect(calls.filter(item => item.method === 'PUT').at(-1).ifMatch).toBe('"etag-1"');

    await expect.poll(async () => page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('lifePlanSyncState') || '{}');
        return { dirty: state.dirty, etag: state.lastRemoteEtag };
    })).toEqual({ dirty: false, etag: '"etag-2"' });
});

test('main auto sync recreates a missing remote even when local data is unchanged', async ({ page }) => {
    const source = emptyData({
        todos: [todoFixture('todo-auto-recreate', '恢复缺失主数据')],
    });
    const calls = [];
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
            webdavUrl: 'https://sync-missing.example.test/dav',
            remotePath: '/life-plan.json',
            autoSync: true,
        }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteEtag: '"old"' }));
    }, source);
    await page.route('https://sync-missing.example.test/dav/life-plan.json', async route => {
        const request = route.request();
        calls.push({ method: request.method(), ifMatch: request.headers()['if-match'] || '' });
        if (request.method() === 'GET') {
            await route.fulfill({ status: 404, body: '' });
            return;
        }
        if (request.method() === 'PUT') {
            await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"recreated"' }, body: JSON.stringify({ ok: true, etag: '"recreated"' }) });
            return;
        }
        await route.fallback();
    });

    await page.clock.install();
    await page.goto('/#/sync');
    await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('lifePlanData'));
        const hash = window.LifePlanSyncService.create().getDataHash(data);
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: false, lastRemoteHash: hash, lastRemoteEtag: '"old"' }));
    });
    const mainCard = page.locator('article.card').filter({ hasText: '主数据 WebDAV 配置' });
    await mainCard.getByRole('button', { name: '立即自动同步一次' }).click();

    await expect.poll(() => calls.filter(item => item.method === 'PUT').length).toBe(1);
    expect(calls.map(item => item.method)).toEqual(['GET', 'PUT']);
    await expect(mainCard.locator('.sync-status')).toContainText('云端文件不存在，已自动上传本地主数据');
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSyncState') || '{}'))).toMatchObject({ dirty: false, lastRemoteEtag: '"recreated"' });
});

test('main auto sync resumes on visibility when enabled', async ({ page }) => {
    const source = emptyData({
        todos: [todoFixture('todo-visible', '恢复同步待办')],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
            webdavUrl: 'https://example.test/dav',
            remotePath: '/life-plan.json',
            autoSync: true,
        }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({
            dirty: false,
            lastRemoteHash: 'same-will-be-replaced',
        }));
    }, source);

    const methods = [];
    await page.route('https://example.test/dav/life-plan.json', async route => {
        methods.push(route.request().method());
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { ETag: '"vis-1"' },
                body: JSON.stringify(source),
            });
            return;
        }
        await route.fulfill({ status: 204, headers: { ETag: '"vis-2"' }, body: '' });
    });

    await page.goto('/#/sync');
    await expect(page.getByRole('button', { name: '保存配置' })).toBeVisible();
    expect(methods.length).toBe(0);
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => methods.filter(method => method === 'GET').length).toBeGreaterThan(0);
});

test('main auto sync stays idle when autoSync is disabled', async ({ page }) => {
    const source = emptyData({
        todos: [todoFixture('todo-no-auto', '不自动同步')],
    });
    await page.addInitScript(data => {
        localStorage.setItem('lifePlanData', JSON.stringify(data));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
            webdavUrl: 'https://example.test/dav',
            remotePath: '/life-plan.json',
            autoSync: false,
        }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({ dirty: true, lastRemoteHash: 'x', lastRemoteEtag: '"e1"' }));
    }, source);

    const methods = [];
    await page.route('https://example.test/dav/life-plan.json', async route => {
        methods.push(route.request().method());
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"e1"' }, body: JSON.stringify(source) });
    });

    await page.clock.install();
    await page.goto('/#/todos');
    await page.getByRole('button', { name: /新建.*待办/ }).click();
    await page.locator('#page-todos input[required]').fill('关闭自动同步后编辑');
    await page.getByRole('button', { name: '保存待办' }).click();
    await page.clock.fastForward(25000);
    await page.waitForTimeout(100);
    expect(methods).toEqual([]);
});
