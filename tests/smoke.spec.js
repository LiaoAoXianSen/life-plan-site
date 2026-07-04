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
