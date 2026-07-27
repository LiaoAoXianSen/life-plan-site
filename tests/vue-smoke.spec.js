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

test('records day view maintains a fixed-width timed event with a complete hover title', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.addInitScript(({ data, date }) => localStorage.setItem('lifePlanData', JSON.stringify({ ...data, records: [{ id: 'record-1', type: '日记', title: '这是一个完整的日程标题', content: '', startDate: date, endDate: date, recordTime: '09:00', recordEndTime: '10:00' }] })), { data: emptyData(), date: today });
    await page.goto('/#/records');
    await page.getByRole('button', { name: '日' }).click();
    const event = page.locator('.agenda-day-column .agenda-event-block').first();
    await expect(event).toHaveAttribute('title', /09:00 - 10:00 这是一个完整的日程标题/);
    await expect(event).toHaveCSS('width', '160px');
});
