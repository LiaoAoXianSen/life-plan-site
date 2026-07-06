const { test, expect } = require('@playwright/test');

test('loads the app and opens core pages', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    await expect(page.locator('#page-dashboard')).toBeVisible();
    await expect(page.locator('#page-dashboard .page-title')).toHaveText('首页仪表盘');

    const pages = [
        ['灵感池', '#page-ideas'],
        ['素材库', '#page-materials'],
        ['标签中心', '#page-tags'],
        ['全局搜索', '#page-search'],
        ['待办总览', '#page-todos'],
        ['习惯打卡', '#page-habits'],
        ['目标管理', '#page-goals'],
        ['工具转盘', '#page-wheel']
    ];

    for (const [label, selector] of pages) {
        await page.locator('.nav-item', { hasText: label }).click();
        await expect(page.locator(selector)).toBeVisible();
    }

    expect(errors).toEqual([]);
});

test('global search page accepts a keyword', async ({ page }) => {
    await page.goto('/');
    await page.locator('.nav-item', { hasText: '全局搜索' }).click();
    await page.locator('#global-search-input').fill('工作');
    await expect(page.locator('#global-search-results')).toBeVisible();
});

test('idea can be converted to a linked todo', async ({ page }) => {
    const sample = require('../test-data/sample-data.json');
    const data = JSON.parse(JSON.stringify(sample));
    data.todos = data.todos.filter(todo => todo.id !== 'sample-todo-idea');
    const idea = data.records.find(record => record.id === 'sample-record-idea');
    idea.ideaTodoId = '';
    idea.ideaStatus = '待整理';

    await page.goto('/');
    await page.evaluate(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), data);
    await page.reload();
    await page.locator('.nav-item', { hasText: '灵感池' }).click();
    await page.locator('.idea-card', { hasText: '把灵感转成小实验' }).getByRole('button', { name: '转成待办' }).click();

    await expect(page.locator('#todo-detail-modal')).toHaveClass(/active/);
    await expect(page.locator('#todo-detail-title')).toHaveText('待办详情');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const updatedIdea = stored.records.find(record => record.id === 'sample-record-idea');
    const linkedTodo = stored.todos.find(todo => todo.id === updatedIdea.ideaTodoId);
    expect(updatedIdea.ideaStatus).toBe('待实践');
    expect(linkedTodo.text).toContain('选一个灵感转成待办');
});

test('habit checkins only award configured currencies', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('lifePlanData'));
    await page.reload();

    await page.locator('[data-page-target="habits"]').click();
    await page.getByRole('button', { name: '+ 新建习惯' }).click();
    await page.locator('#habit-name').fill('默认无奖励习惯');
    await page.locator('#habit-note-mode').selectOption('never');
    await page.getByRole('button', { name: '保存' }).click();

    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    let habit = stored.habits.find(item => item.name === '默认无奖励习惯');
    expect(habit.rewardPoints).toBe(0);
    expect(stored.habitPointLedger).toHaveLength(0);

    await page.locator('[data-page-target="dashboard"]').click();
    await page.locator('.habit-quick-card', { hasText: '默认无奖励习惯' }).getByRole('button', { name: '打卡' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.habitPointLedger).toHaveLength(0);

    await page.locator('[data-page-target="habits"]').click();
    await page.getByRole('button', { name: '+ 新建习惯' }).click();
    await page.locator('#habit-name').fill('奖励入账习惯');
    await page.locator('#habit-note-mode').selectOption('never');
    await page.locator('#habit-points-panel summary').click();
    await page.locator('#habit-reward-points').fill('5');
    await page.locator('#habit-reward-currency').fill('星星');
    await page.getByRole('button', { name: '保存' }).click();

    await page.locator('[data-page-target="dashboard"]').click();
    await page.locator('.habit-quick-card', { hasText: '奖励入账习惯' }).getByRole('button', { name: '打卡' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    habit = stored.habits.find(item => item.name === '奖励入账习惯');
    const rewardEntry = stored.habitPointLedger.find(entry => entry.habitId === habit.id && entry.type === 'checkin');
    expect(rewardEntry.amount).toBe(5);
    expect(rewardEntry.currency).toBe('星星');
});

test('wheel library copy is tag-filtered and history can be exported', async ({ page }) => {
    const data = {
        records: [],
        todos: [],
        habits: [],
        checkins: [],
        habitPointLedger: [],
        habitRewards: [],
        habitCurrencies: [],
        templates: [],
        goals: [],
        deletedItems: [],
        materials: [],
        wheels: [
            {
                id: 'wheel-normal',
                name: '测试普通盘',
                mode: 'normal',
                items: [{ id: 'normal-tea', name: '喝茶', weight: 1, enabled: true }],
                createdAt: '2026-07-06 10:00',
                updatedAt: '2026-07-06 10:00'
            }
        ],
        wheelTags: [
            { id: 'tag-food', name: '美食', color: '#e86c52', weight: 1, enabled: true },
            { id: 'tag-sport', name: '运动', color: '#3e65b0', weight: 1, enabled: true }
        ],
        wheelLibraryItems: [
            { id: 'library-hotpot', name: '火锅', weight: 2, enabled: true, tagIds: ['tag-food'] },
            { id: 'library-run', name: '跑步', weight: 1, enabled: true, tagIds: ['tag-sport'] }
        ],
        wheelHistory: [
            {
                id: 'history-1',
                wheelId: 'wheel-normal',
                wheelName: '测试普通盘',
                mode: 'normal',
                resultId: 'normal-tea',
                resultName: '喝茶',
                note: '',
                convertedTodoId: '',
                createdAt: '2026-07-06 10:10',
                updatedAt: '2026-07-06 10:10'
            }
        ]
    };

    await page.goto('/');
    await page.evaluate(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), data);
    await page.reload();
    await page.locator('.nav-item', { hasText: '工具转盘' }).click();
    await expect(page.locator('#wheel-canvas')).toBeVisible();

    await page.locator('#wheel-panel-toggle').click();
    const copyFilter = page.locator('#wheel-panel-body .wheel-copy-filter');
    await copyFilter.getByRole('button', { name: /美食/ }).click();
    await expect(page.locator('#wheel-library-copy-select option')).toHaveText(['从公共项复制到当前转盘', '火锅']);

    await page.locator('#wheel-library-copy-select').selectOption('library-hotpot');
    await page.getByRole('button', { name: '复制' }).click();
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    let copied = stored.wheels[0].items.find(item => item.name === '火锅');
    expect(copied.sourceLibraryItemId).toBe('library-hotpot');

    await page.locator('#wheel-library-copy-select').selectOption('library-hotpot');
    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('同名选项');
        dialog.accept();
    });
    await page.getByRole('button', { name: '复制' }).click();

    await page.locator('#wheel-panel-tabs').getByRole('button', { name: '记录' }).click();
    await expect(page.getByRole('button', { name: '导出记录' })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出记录' }).click();
    await expect((await download).suggestedFilename()).toContain('大转盘抽取记录');

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheels[0].items.filter(item => item.name === '火锅')).toHaveLength(1);
});
