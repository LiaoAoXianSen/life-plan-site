const { test, expect } = require('@playwright/test');

function emptyData(overrides = {}) {
    return {
        records: [], todos: [], habits: [], checkins: [], habitPointLedger: [], habitRewards: [], habitCurrencies: [], templates: [], goals: [], deletedItems: [], materials: [], bodyMetrics: [], fitnessPlans: [], fitnessWorkouts: [], exerciseLibrary: [], wheels: [], wheelTags: [], wheelLibraryItems: [], wheelHistory: [], ...overrides
    };
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
