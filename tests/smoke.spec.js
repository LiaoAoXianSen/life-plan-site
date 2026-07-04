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
        ['习惯热力图', '#page-habits'],
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
