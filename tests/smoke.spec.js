const { test, expect } = require('@playwright/test');

function createEmptyData(overrides = {}) {
    return {
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
        bodyMetrics: [],
        fitnessPlans: [],
        fitnessWorkouts: [],
        exerciseLibrary: [],
        wheels: [],
        wheelTags: [],
        wheelLibraryItems: [],
        wheelHistory: [],
        ...overrides
    };
}

function hashString(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
}

function hashData(value) {
    return hashString(JSON.stringify(value || {}));
}

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
        ['运动健身', '#page-fitness'],
        ['目标管理', '#page-goals'],
        ['工具转盘', '#page-wheel']
    ];

    for (const [label, selector] of pages) {
        await page.locator('.nav-item', { hasText: label }).click();
        await expect(page.locator(selector)).toBeVisible();
    }

    expect(errors).toEqual([]);
});

test('fitness page can create body metric records', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });

    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, createEmptyData());

    await page.goto('/');
    await page.locator('.nav-item', { hasText: '运动健身' }).click();
    await expect(page.locator('#page-fitness')).toBeVisible();
    await expect(page.locator('#page-fitness .page-title')).toHaveText('运动健身');

    await page.locator('#page-fitness .btn', { hasText: '记录身材' }).first().click();
    await expect(page.locator('#body-metric-modal')).toBeVisible();
    await page.fill('#body-metric-weight', '72.4');
    await page.fill('#body-metric-bodyFat', '18.6');
    await page.fill('#body-metric-waist', '82');
    await page.fill('#body-metric-note', '早上空腹');
    await page.locator('#body-metric-modal .btn.btn-primary', { hasText: '保存' }).click();

    await expect(page.locator('#fitness-body-metric-list')).toContainText('72.4');
    await expect(page.locator('#fitness-body-metric-list')).toContainText('腰围');
    await expect(page.locator('#fitness-summary')).toContainText('72.4');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.bodyMetrics).toHaveLength(1);
    expect(stored.bodyMetrics[0].weight).toBe(72.4);
    expect(stored.bodyMetrics[0].bodyFat).toBe(18.6);
    expect(stored.bodyMetrics[0].waist).toBe(82);
    expect(stored.bodyMetrics[0].note).toBe('早上空腹');
    expect(errors).toEqual([]);
});

test('fitness page can create training plans', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });

    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, createEmptyData());

    await page.goto('/');
    await page.locator('.nav-item', { hasText: '运动健身' }).click();
    await expect(page.locator('#page-fitness')).toBeVisible();

    await page.locator('#page-fitness .btn', { hasText: '新建计划' }).first().click();
    await expect(page.locator('#fitness-plan-modal')).toBeVisible();
    await page.fill('#fitness-plan-name', '推拉腿');
    await page.selectOption('#fitness-plan-goal', 'hypertrophy');
    await page.fill('#fitness-plan-notes', '健身房三分化');

    const firstExercise = page.locator('.fitness-plan-exercise-card').first();
    await firstExercise.locator('.fitness-plan-exercise-card-head input').fill('深蹲');
    // Default draft has 3 sets; add one more for a 4-set prescription.
    await firstExercise.locator('button', { hasText: '+ 加一组' }).click();
    const setRows = firstExercise.locator('.fitness-plan-set-row');
    await expect(setRows).toHaveCount(4);
    await setRows.nth(0).locator('input[type="number"]').nth(0).fill('100');
    await setRows.nth(0).locator('input[type="number"]').nth(1).fill('6');
    await setRows.nth(1).locator('input[type="number"]').nth(0).fill('100');
    await setRows.nth(1).locator('input[type="number"]').nth(1).fill('8');
    await setRows.nth(2).locator('input[type="number"]').nth(0).fill('95');
    await setRows.nth(2).locator('input[type="number"]').nth(1).fill('8');
    await setRows.nth(3).locator('input[type="number"]').nth(0).fill('95');
    await setRows.nth(3).locator('input[type="number"]').nth(1).fill('8');

    await page.locator('#fitness-plan-modal .btn.btn-primary', { hasText: '保存' }).click();
    await expect(page.locator('#fitness-plan-list .fitness-plan-card')).toContainText('推拉腿');
    await expect(page.locator('#fitness-plan-list .fitness-plan-card')).toContainText('深蹲');
    await expect(page.locator('#fitness-plan-list .fitness-plan-card')).toContainText('增肌');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.fitnessPlans).toHaveLength(1);
    expect(stored.fitnessPlans[0].name).toBe('推拉腿');
    expect(stored.fitnessPlans[0].goal).toBe('hypertrophy');
    expect(stored.fitnessPlans[0].exercises[0].name).toBe('深蹲');
    expect(stored.fitnessPlans[0].exercises[0].targetSets).toBe(4);
    expect(stored.fitnessPlans[0].exercises[0].sets).toHaveLength(4);
    expect(stored.fitnessPlans[0].exercises[0].sets[0]).toMatchObject({ weight: 100, reps: 6 });
    expect(stored.fitnessPlans[0].exercises[0].sets[2]).toMatchObject({ weight: 95, reps: 8 });
    expect(errors).toEqual([]);
});

test('fitness page can create workout logs from free training', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });

    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, createEmptyData());

    await page.goto('/');
    await page.locator('.nav-item', { hasText: '运动健身' }).click();
    await expect(page.locator('#page-fitness')).toBeVisible();

    await page.locator('#page-fitness .btn', { hasText: '补记' }).first().click();
    await expect(page.locator('#fitness-workout-modal')).toBeVisible();
    await page.fill('#fitness-workout-title', '自由上肢');
    await page.selectOption('#fitness-workout-status', 'done');
    await page.fill('#fitness-workout-duration', '55');
    await page.fill('#fitness-workout-notes', '状态不错');

    const exerciseEditor = page.locator('.fitness-workout-exercise-editor').first();
    await exerciseEditor.locator('input[type="text"]').first().fill('卧推');
    const firstSet = exerciseEditor.locator('.fitness-workout-set-row').first();
    await firstSet.locator('input[type="number"]').nth(0).fill('60');
    await firstSet.locator('input[type="number"]').nth(1).fill('8');
    await firstSet.locator('input[type="checkbox"]').check();

    await page.locator('#fitness-workout-modal .btn.btn-primary', { hasText: '保存' }).click();
    await expect(page.locator('#fitness-workout-list')).toContainText('自由上肢');
    await expect(page.locator('#fitness-workout-list')).toContainText('卧推');
    await expect(page.locator('#fitness-workout-list')).toContainText('已完成');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.fitnessWorkouts).toHaveLength(1);
    expect(stored.fitnessWorkouts[0].title).toBe('自由上肢');
    expect(stored.fitnessWorkouts[0].status).toBe('done');
    expect(stored.fitnessWorkouts[0].durationMin).toBe(55);
    expect(stored.fitnessWorkouts[0].exercises[0].name).toBe('卧推');
    expect(stored.fitnessWorkouts[0].exercises[0].sets[0].weight).toBe(60);
    expect(stored.fitnessWorkouts[0].exercises[0].sets[0].reps).toBe(8);
    expect(stored.fitnessWorkouts[0].exercises[0].sets[0].done).toBe(true);
    expect(errors).toEqual([]);
});


test('fitness live workout can complete sets and finish session', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });

    const today = new Date();
    const todayStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
    ].join('-');
    const weekday = today.getDay();

    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, createEmptyData({
        exerciseLibrary: [
            {
                id: 'lib-squat',
                name: '杠铃深蹲',
                muscle: 'leg',
                defaultSets: 3,
                defaultReps: '5',
                restSec: 90,
                createdAt: `${todayStr} 08:00`,
                updatedAt: `${todayStr} 08:00`
            }
        ],
        fitnessPlans: [
            {
                id: 'plan-live',
                name: '力量日',
                goal: 'strength',
                status: 'active',
                weekdays: [weekday],
                notes: '',
                days: [
                    {
                        id: 'day-live',
                        name: 'A 日',
                        exercises: [{ id: 'ex-live', name: '杠铃深蹲', targetSets: 2, targetReps: '5', targetWeight: 100 }]
                    }
                ],
                createdAt: `${todayStr} 08:00`,
                updatedAt: `${todayStr} 08:00`
            }
        ],
        fitnessWorkouts: [
            {
                id: 'history-1',
                date: todayStr,
                status: 'done',
                title: '历史深蹲',
                notes: '',
                durationMin: 30,
                exercises: [
                    {
                        id: 'hex-1',
                        name: '杠铃深蹲',
                        sets: [{ id: 'hset-1', weight: 95, reps: 5, done: true }]
                    }
                ],
                createdAt: `${todayStr} 07:00`,
                updatedAt: `${todayStr} 07:00`
            }
        ]
    }));

    await page.goto('/');
    await page.locator('.nav-item', { hasText: '运动健身' }).click();
    await expect(page.locator('#page-fitness')).toBeVisible();
    await page.locator('#page-fitness .btn', { hasText: '动作库' }).first().click();
    await expect(page.locator('#fitness-library-modal')).toBeVisible();
    await expect(page.locator('#fitness-modal-library-list')).toContainText('杠铃深蹲');
    await page.locator('#fitness-library-modal .btn.btn-secondary', { hasText: '关闭' }).click();

    await page.locator('#fitness-overview .btn.btn-primary', { hasText: '按计划开练' }).click();
    await expect(page.locator('#fitness-live-modal')).toBeVisible();
    await expect(page.locator('#fitness-live-body')).toContainText('杠铃深蹲');
    await expect(page.locator('#fitness-live-body')).toContainText('上次');

    const firstSet = page.locator('.fitness-live-set-row').first();
    await firstSet.locator('input[type="number"]').nth(0).fill('105');
    await firstSet.locator('input[type="number"]').nth(1).fill('5');
    await firstSet.locator('button', { hasText: '完成' }).click();
    await expect(page.locator('#fitness-rest-timer')).toBeVisible();
    await page.locator('#fitness-rest-timer .btn', { hasText: '跳过' }).click();

    const secondSet = page.locator('.fitness-live-set-row').nth(1);
    await secondSet.locator('input[type="number"]').nth(0).fill('105');
    await secondSet.locator('input[type="number"]').nth(1).fill('4');
    await secondSet.locator('button', { hasText: '完成' }).click();
    await page.locator('#fitness-rest-timer .btn', { hasText: '跳过' }).click();

    const dialogMessages = [];
    page.on('dialog', async dialog => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
    });
    await page.locator('#fitness-live-modal .btn.btn-primary', { hasText: '结束训练' }).click();
    await expect(page.locator('#fitness-live-modal')).toBeHidden();
    await expect(page.locator('#fitness-workout-list')).toContainText('力量日');
    await expect(page.locator('#fitness-workout-list')).toContainText('已完成');
    expect(dialogMessages.some(message => message.includes('写回计划'))).toBe(true);

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const live = stored.fitnessWorkouts.find(item => item.title === '力量日' || item.planId === 'plan-live');
    expect(live).toBeTruthy();
    expect(live.status).toBe('done');
    expect(live.exercises[0].sets.some(set => set.done)).toBe(true);
    const plan = stored.fitnessPlans.find(item => item.id === 'plan-live');
    expect(plan.exercises[0].sets[0]).toMatchObject({ weight: 105, reps: 5 });
    expect(plan.exercises[0].sets[1]).toMatchObject({ weight: 105, reps: 4 });
    expect(Array.isArray(stored.exerciseLibrary)).toBe(true);
    expect(stored.exerciseLibrary.some(item => item.name === '杠铃深蹲')).toBe(true);
    expect(errors).toEqual([]);
});


test('fitness plan can pick exercises from library', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });

    const today = new Date();
    const todayStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
    ].join('-');

    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, createEmptyData({
        exerciseLibrary: [
            {
                id: 'lib-bench',
                name: '杠铃卧推',
                muscle: 'chest',
                defaultSets: 4,
                defaultReps: '6-8',
                defaultWeight: 60,
                restSec: 120,
                createdAt: `${todayStr} 08:00`,
                updatedAt: `${todayStr} 08:00`
            }
        ]
    }));

    await page.goto('/');
    await page.locator('.nav-item', { hasText: '运动健身' }).click();
    await page.locator('#page-fitness .btn', { hasText: '新建计划' }).first().click();
    await expect(page.locator('#fitness-plan-modal')).toBeVisible();
    await page.fill('#fitness-plan-name', '推日计划');
    await page.locator('#fitness-plan-exercises-editor .btn', { hasText: '从动作库选择' }).click();
    await expect(page.locator('#fitness-library-modal')).toBeVisible();
    await page.locator('#fitness-modal-library-list .fitness-library-card', { hasText: '杠铃卧推' }).click();
    await expect(page.locator('#fitness-library-modal')).toBeHidden();
    await expect(page.locator('#fitness-plan-exercises-editor .fitness-plan-exercise-card-head input').first()).toHaveValue('杠铃卧推');
    await expect(page.locator('#fitness-plan-exercises-editor .fitness-plan-set-row')).toHaveCount(4);
    await page.locator('#fitness-plan-modal .btn.btn-primary', { hasText: '保存' }).click();
    await expect(page.locator('#fitness-plan-list')).toContainText('推日计划');
    await expect(page.locator('#fitness-plan-list')).toContainText('杠铃卧推');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.fitnessPlans).toHaveLength(1);
    expect(stored.fitnessPlans[0].exercises[0].name).toBe('杠铃卧推');
    expect(stored.fitnessPlans[0].exercises[0].targetSets).toBe(4);
    expect(stored.fitnessPlans[0].exercises[0].targetWeight).toBe(60);
    expect(stored.fitnessPlans[0].exercises[0].sets).toHaveLength(4);
    expect(stored.fitnessPlans[0].exercises[0].sets[0]).toMatchObject({ weight: 60, reps: 6 });
    expect(errors).toEqual([]);
});

test('fitness overview appears on fitness page and dashboard', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });

    const today = new Date();
    const todayStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
    ].join('-');
    const weekday = today.getDay();

    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, createEmptyData({
        bodyMetrics: [
            {
                id: 'metric-1',
                date: todayStr,
                weight: 71.5,
                waist: 81,
                condition: 'fasted',
                note: '',
                createdAt: `${todayStr} 08:00`,
                updatedAt: `${todayStr} 08:00`
            }
        ],
        fitnessPlans: [
            {
                id: 'plan-1',
                name: '全身训练',
                goal: 'strength',
                status: 'active',
                weekdays: [weekday],
                notes: '',
                days: [
                    {
                        id: 'day-1',
                        name: 'A 日',
                        exercises: [{ id: 'ex-1', name: '深蹲', targetSets: 3, targetReps: '5' }]
                    }
                ],
                createdAt: `${todayStr} 08:00`,
                updatedAt: `${todayStr} 08:00`
            }
        ],
        fitnessWorkouts: [
            {
                id: 'workout-1',
                date: todayStr,
                status: 'done',
                title: '全身训练 · A 日',
                planId: 'plan-1',
                planName: '全身训练',
                dayId: 'day-1',
                dayName: 'A 日',
                notes: '',
                durationMin: 40,
                exercises: [
                    {
                        id: 'wex-1',
                        name: '深蹲',
                        sets: [{ id: 'set-1', weight: 100, reps: 5, done: true }]
                    }
                ],
                createdAt: `${todayStr} 09:00`,
                updatedAt: `${todayStr} 09:00`
            }
        ]
    }));

    await page.goto('/');
    await expect(page.locator('#dashboard-command-center')).toContainText('运动健身');
    await expect(page.locator('#dashboard-command-center')).toContainText('71.5');
    await expect(page.locator('#hero-meta')).toContainText('近30天训练');

    await page.locator('.nav-item', { hasText: '运动健身' }).click();
    await expect(page.locator('#fitness-overview')).toContainText('今日状态');
    await expect(page.locator('#fitness-overview')).toContainText('今天已有 1 条训练记录');
    await expect(page.locator('#fitness-summary')).toContainText('71.5');
    await expect(page.locator('#fitness-summary')).toContainText('近 30 天训练');
    expect(errors).toEqual([]);
});

test('local save failure keeps recovery actions visible until retry succeeds', async ({ page }) => {
    const data = createEmptyData();
    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
        const originalSetItem = Storage.prototype.setItem;
        let failMainData = true;
        window.__allowLifePlanDataWrites = () => {
            failMainData = false;
        };
        Storage.prototype.setItem = function setItem(key, itemValue) {
            if (key === 'lifePlanData' && failMainData) {
                throw new DOMException('quota exceeded', 'QuotaExceededError');
            }
            return originalSetItem.call(this, key, itemValue);
        };
    }, data);

    await page.goto('/');

    const saved = await page.evaluate(() => saveData());
    expect(saved).toBe(false);
    await expect(page.locator('.sidebar-bottom')).toHaveAttribute('open', '');
    await expect(page.locator('#local-save-warning')).toBeVisible();
    await expect(page.locator('#local-save-warning')).toContainText('主数据未可靠保存');
    await expect(page.getByRole('button', { name: '立即导出' })).toBeVisible();
    await expect(page.getByRole('button', { name: '管理快照' })).toBeVisible();
    await expect(page.getByRole('button', { name: '重试保存' })).toBeVisible();
    const failures = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanCriticalFailures') || '[]'));
    expect(failures.some(item => item.label === '主数据写入失败' && item.message.includes('quota exceeded'))).toBe(true);

    await page.evaluate(() => openSnapshotModal());
    await expect(page.locator('#critical-failure-log')).toContainText('主数据写入失败');
    await expect(page.locator('#critical-failure-log')).toContainText('quota exceeded');
    await page.evaluate(() => closeSnapshotModal());

    await page.evaluate(() => {
        for (let i = 1; i <= 6; i += 1) {
            recordCriticalFailure(`测试失败 ${i}`, null, { message: `错误 ${i}` });
        }
    });
    const cappedFailures = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanCriticalFailures') || '[]'));
    expect(cappedFailures).toHaveLength(5);
    expect(cappedFailures[0].label).toBe('测试失败 6');
    expect(cappedFailures.some(item => item.label === '主数据写入失败')).toBe(false);

    await page.evaluate(() => window.__allowLifePlanDataWrites());
    await page.getByRole('button', { name: '重试保存' }).click();

    await expect(page.locator('#local-save-warning')).toBeHidden();
    await expect(page.locator('#sync-status')).toContainText('本地数据已重新保存');
});

test('snapshot write failure reports failure instead of a fake success', async ({ page }) => {
    const data = createEmptyData();
    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function setItem(key, itemValue) {
            if (key === 'lifePlanSnapshots') {
                throw new DOMException('quota exceeded', 'QuotaExceededError');
            }
            return originalSetItem.call(this, key, itemValue);
        };
    }, data);

    await page.goto('/');
    await page.evaluate(() => openSnapshotModal());
    await expect(page.locator('#snapshot-modal')).toHaveClass(/active/);

    await page.getByRole('button', { name: '立即创建快照' }).click();

    await expect(page.locator('#sync-status')).toContainText('本地快照写入失败');
    await expect(page.locator('#sync-status-inline')).toContainText('同步：失败');
    const rawSnapshots = await page.evaluate(() => localStorage.getItem('lifePlanSnapshots'));
    expect(rawSnapshots).toBeNull();
});

test('legacy sync credentials are removed from cloud sync settings', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
            webdavUrl: 'https://sync.example.test',
            username: 'legacy-user',
            password: 'legacy-password',
            remotePath: '/life-plan.json',
            autoSync: false
        }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({ remotePath: '/apps/wheel-app/data.json', autoSync: false }));
    });

    await page.goto('/');
    await page.evaluate(() => openSyncSettings());

    await expect(page.locator('#sync-username')).toHaveCount(0);
    await expect(page.locator('#sync-password')).toHaveCount(0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSyncConfig')));
    expect(stored).toEqual({
        webdavUrl: 'https://sync.example.test',
        remotePath: '/life-plan.json',
        autoSync: false
    });
});

test('dashboard and record timeline default to bounded recent ranges', async ({ page }) => {
    const data = createEmptyData({
        records: [
            {
                id: 'record-today',
                type: '日记',
                title: '今天范围内记录',
                content: '今天应该默认显示。',
                startDate: '2026-07-14',
                endDate: '2026-07-14',
                recordTime: '09:00',
                todoIds: []
            },
            {
                id: 'record-window-start',
                type: '日记',
                title: '三十天边界记录',
                content: '今天凌晨作为截止时，近30天应包含前29天。',
                startDate: '2026-06-15',
                endDate: '2026-06-15',
                recordTime: '10:00',
                todoIds: []
            },
            {
                id: 'record-old',
                type: '日记',
                title: '历史范围外记录',
                content: '默认范围不应该显示。',
                startDate: '2026-06-14',
                endDate: '2026-06-14',
                recordTime: '11:00',
                todoIds: []
            }
        ]
    });

    await page.clock.setFixedTime(new Date('2026-07-14T17:32:00+08:00'));
    await page.addInitScript(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), data);
    await page.goto('/');

    await expect(page.locator('#dashboard-timeline-range')).toHaveValue('30');
    await expect(page.locator('#timeline')).toContainText('今天范围内记录');
    await expect(page.locator('#timeline')).toContainText('三十天边界记录');
    await expect(page.locator('#timeline')).not.toContainText('历史范围外记录');

    await page.locator('.nav-item', { hasText: '所有记录' }).click();
    await expect(page.locator('#record-list-range')).toHaveValue('30');
    await expect(page.locator('#all-records')).toContainText('今天范围内记录');
    await expect(page.locator('#all-records')).toContainText('三十天边界记录');
    await expect(page.locator('#all-records')).not.toContainText('历史范围外记录');

    await page.locator('#record-list-range').selectOption('all');
    await expect(page.locator('#all-records')).toContainText('历史范围外记录');

    await page.locator('#record-view-tabs button', { hasText: '日视图' }).click();
    await expect(page.locator('#record-list-range')).toBeHidden();
    await expect(page.locator('#all-records')).toContainText('今天范围内记录');
    await expect(page.locator('#all-records')).not.toContainText('三十天边界记录');
});

test('record todo text is rendered as text, not executable HTML', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
        localStorage.removeItem('lifePlanData');
        window.__xssFired = false;
    });
    await page.reload();

    await page.evaluate(() => {
        window.__xssFired = false;
        createRecord('日记');
    });
    const payload = '<img src=x onerror="window.__xssFired = true"> 记录待办';
    await page.locator('#new-todo-input').fill(payload);
    await page.getByRole('button', { name: '添加' }).click();

    const todoText = page.locator('#record-todos .todo-text');
    await expect(todoText).toHaveText(payload);
    await expect(page.locator('#record-todos img')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__xssFired)).toBe(false);
});

test('imported labels cannot inject classes, handlers, or goal markup', async ({ page }) => {
    const data = createEmptyData({
        records: [
            {
                id: 'record-malicious-class',
                type: '日记" onclick="window.__xssFired = true" bad="',
                title: '带恶意类型的记录',
                content: '类型应该只作为文本显示。',
                startDate: '2026-07-13',
                endDate: '2026-07-13',
                time: '09:00',
                todoIds: []
            },
            {
                id: 'record-malicious-period',
                type: '周计划',
                title: '<img src=x onerror="window.__xssFired = true"> 安全周期',
                content: '周期记录标题应该只作为文本显示。',
                startDate: '2026-07-13',
                endDate: '2099-12-31',
                time: '10:00',
                todoIds: []
            }
        ],
        todos: [
            {
                id: 'todo-malicious-group',
                text: '带恶意分组的待办',
                done: false,
                group: '工作" onclick="window.__xssFired = true" bad="',
                dueDate: '2026-07-13',
                urgency: 'urgent" onclick="window.__xssFired = true" bad="',
                createdAt: '2026-07-13T09:00'
            }
        ],
        habits: [
            {
                id: 'habit-malicious',
                name: '<img src=x onerror="window.__xssFired = true"> 安全习惯',
                tag: '运动" onclick="window.__xssFired = true" bad="',
                targetCount: 1,
                noteMode: 'never',
                rewardPoints: 0,
                penaltyPoints: 0,
                createdAt: '2026-07-13T09:00'
            }
        ],
        goals: [
            {
                id: 'goal-malicious',
                name: '<img src=x onerror="window.__xssFired = true"> 安全目标',
                period: '<svg onload="window.__xssFired = true"></svg> 7月',
                target: '<img src=x onerror="window.__xssFired = true"> 完成一件事',
                status: '进行中',
                progress: 40
            }
        ]
    });

    await page.addInitScript(value => {
        window.__xssFired = false;
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, data);
    await page.goto('/');

    await expect(page.locator('#active-periods')).toContainText('<img src=x onerror="window.__xssFired = true"> 安全周期');
    await expect(page.locator('#active-periods img')).toHaveCount(0);

    await page.locator('[data-page-target="records"]').click();
    await expect(page.locator('#all-records')).toContainText('日记" onclick="window.__xssFired = true" bad="');
    await expect(page.locator('[onclick*="__xssFired"]')).toHaveCount(0);

    await page.locator('[data-page-target="todos"]').click();
    await expect(page.locator('#todo-table-body')).toContainText('工作" onclick="window.__xssFired = true" bad="');
    const urgencyClass = await page.locator('#todo-table-body .todo-urgency').evaluate(el => el.className);
    expect(urgencyClass).not.toContain('onclick');
    expect(urgencyClass).not.toContain('bad');
    await expect(page.locator('[onclick*="__xssFired"]')).toHaveCount(0);

    await page.locator('[data-page-target="habits"]').click();
    await expect(page.locator('#habit-tabs')).toContainText('<img src=x onerror="window.__xssFired = true"> 安全习惯');
    await expect(page.locator('#habit-tabs img')).toHaveCount(0);

    await page.locator('[data-page-target="goals"]').click();
    await expect(page.locator('#goal-list')).toContainText('<img src=x onerror="window.__xssFired = true"> 安全目标');
    await expect(page.locator('#goal-list img')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__xssFired)).toBe(false);
});

test('cloud sync requests fail with a 20 second timeout message', async ({ page }) => {
    await page.goto('/');

    const message = await page.evaluate(async () => {
        const originalSetTimeout = window.setTimeout;
        const originalClearTimeout = window.clearTimeout;
        window.setTimeout = (callback, delay, ...args) => {
            if (delay === 20000) {
                callback(...args);
                return 1;
            }
            return originalSetTimeout(callback, delay, ...args);
        };
        window.clearTimeout = timer => {
            if (timer !== 1) originalClearTimeout(timer);
        };

        try {
            const service = LifePlanSyncService.create({
                appSyncKit: () => null,
                fetchImpl: (_url, options = {}) => new Promise((_resolve, reject) => {
                    if (options.signal?.aborted) {
                        reject(new DOMException('aborted', 'AbortError'));
                        return;
                    }
                    options.signal?.addEventListener('abort', () => {
                        reject(new DOMException('aborted', 'AbortError'));
                    }, { once: true });
                })
            });
            await service.pullJson({ webdavUrl: 'https://sync.example.test' }, '/life-plan.json');
            return 'no-error';
        } catch (err) {
            return err.message || String(err);
        } finally {
            window.setTimeout = originalSetTimeout;
            window.clearTimeout = originalClearTimeout;
        }
    });

    expect(message).toContain('同步请求超时');
});

test('sync failures are recorded in the critical failure log', async ({ page }) => {
    await page.route('https://sync-fail.example.test/**', async route => {
        await route.fulfill({ status: 500, body: 'sync unavailable' });
    });
    await page.goto('/');

    await page.evaluate(() => {
        document.getElementById('sync-webdav-url').value = 'https://sync-fail.example.test';
        document.getElementById('sync-remote-path').value = '/life-plan.json';
        document.getElementById('sync-auto').checked = false;
        document.getElementById('wheel-sync-remote-path').value = '/apps/wheel-app/data.json';
        document.getElementById('wheel-sync-auto').checked = false;
    });

    const mainMessage = await page.evaluate(() => runCloudSync('both').catch(err => err.message));
    const wheelMessage = await page.evaluate(() => runWheelCloudSync('both', true).catch(err => err.message));
    expect(mainMessage).toContain('WebDAV GET');
    expect(wheelMessage).toContain('WebDAV GET');

    const failures = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanCriticalFailures') || '[]'));
    expect(failures).toEqual(expect.arrayContaining([
        expect.objectContaining({ label: '云同步失败', action: 'cloud-sync-both' }),
        expect.objectContaining({ label: '大转盘同步失败', action: 'wheel-cloud-sync-both' })
    ]));

    await page.evaluate(() => openSnapshotModal());
    await expect(page.locator('#critical-failure-log')).toContainText('云同步失败');
    await expect(page.locator('#critical-failure-log')).toContainText('大转盘同步失败');
});

test('edits during an active cloud sync trigger one follow-up upload', async ({ page }) => {
    const initialData = createEmptyData({
        todos: [
            {
                id: 'initial-todo',
                text: '同步前待办',
                note: '',
                done: false,
                dueDate: '',
                planStartDate: '',
                planEndDate: '',
                urgency: 'medium',
                group: '工作',
                subTodos: [],
                sessions: [],
                createdAt: '2026-07-13T10:00:00',
                updatedAt: '2026-07-13T10:00:00'
            }
        ]
    });
    let remoteData = createEmptyData();
    let putCount = 0;
    let activePuts = 0;
    let maxActivePuts = 0;
    let firstPutStarted = false;
    let releaseFirstPut;

    await page.route('https://sync.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === '/life-plan.json' && request.method() === 'GET') {
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(remoteData) });
            return;
        }
        if (url.pathname === '/life-plan.json' && request.method() === 'PUT') {
            putCount += 1;
            activePuts += 1;
            maxActivePuts = Math.max(maxActivePuts, activePuts);
            const nextRemoteData = JSON.parse(request.postData() || '{}');
            if (putCount === 1) {
                firstPutStarted = true;
                await new Promise(resolve => {
                    releaseFirstPut = resolve;
                });
            }
            remoteData = nextRemoteData;
            activePuts -= 1;
            await route.fulfill({ status: 204, body: '' });
            return;
        }
        await route.fulfill({ status: 404, body: '' });
    });

    await page.addInitScript(({ value, valueHash }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
            webdavUrl: 'https://sync.example.test',
            username: '',
            password: '',
            remotePath: '/life-plan.json',
            autoSync: false
        }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({ remotePath: '/apps/wheel-app/data.json', autoSync: false }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({
            dirty: true,
            lastLocalHash: valueHash,
            lastRemoteHash: '',
            lastSyncAt: '',
            lastPullAt: '',
            lastPushAt: '',
            lastConflictAt: ''
        }));
    }, { value: initialData, valueHash: hashData(initialData) });

    await page.goto('/');
    const firstSync = page.evaluate(() => runCloudSync('up').catch(err => err.message));
    await expect.poll(() => firstPutStarted).toBe(true);

    await page.evaluate(() => {
        const stamp = getLocalDateTimeStr();
        data.todos.push({
            id: 'queued-edit-todo',
            text: '同步期间新增的待办',
            note: '',
            done: false,
            dueDate: '',
            planStartDate: '',
            planEndDate: '',
            urgency: 'medium',
            group: '工作',
            subTodos: [],
            sessions: [],
            createdAt: stamp,
            updatedAt: stamp
        });
        saveData();
        runCloudSync('up');
    });

    releaseFirstPut();
    await firstSync;

    await expect.poll(() => putCount).toBe(2);
    expect(maxActivePuts).toBe(1);
    expect(remoteData.todos.map(todo => todo.id)).toContain('queued-edit-todo');
});

test('cloud sync retries a stale conditional upload after merging latest remote data', async ({ page }) => {
    const remoteBase = createEmptyData({
        todos: [
            {
                id: 'shared-remote-todo',
                text: '同步基线待办',
                note: '',
                done: false,
                dueDate: '',
                planStartDate: '',
                planEndDate: '',
                urgency: 'medium',
                group: '工作',
                subTodos: [],
                sessions: [],
                createdAt: '2026-07-14T09:00:00',
                updatedAt: '2026-07-14T09:00:00'
            }
        ]
    });
    const localData = createEmptyData({
        todos: [
            ...remoteBase.todos,
            {
                id: 'local-new-todo',
                text: '本机新增待办',
                note: '',
                done: false,
                dueDate: '',
                planStartDate: '',
                planEndDate: '',
                urgency: 'high',
                group: '工作',
                subTodos: [],
                sessions: [],
                createdAt: '2026-07-14T09:05:00',
                updatedAt: '2026-07-14T09:05:00'
            }
        ]
    });
    const remoteChanged = createEmptyData({
        todos: [
            ...remoteBase.todos,
            {
                id: 'remote-new-todo',
                text: '另一台设备新增待办',
                note: '',
                done: false,
                dueDate: '',
                planStartDate: '',
                planEndDate: '',
                urgency: 'medium',
                group: '工作',
                subTodos: [],
                sessions: [],
                createdAt: '2026-07-14T09:06:00',
                updatedAt: '2026-07-14T09:06:00'
            }
        ]
    });
    let remoteData = remoteBase;
    let remoteEtag = '"v1"';
    let getCount = 0;
    let putCount = 0;
    const putIfMatchHeaders = [];
    const etagHeaders = etag => ({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'ETag, X-Remote-ETag',
        ETag: etag
    });

    await page.route('https://sync-etag.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === '/life-plan.json' && request.method() === 'GET') {
            getCount += 1;
            await route.fulfill({
                contentType: 'application/json',
                headers: etagHeaders(remoteEtag),
                body: JSON.stringify(remoteData)
            });
            return;
        }
        if (url.pathname === '/life-plan.json' && request.method() === 'PUT') {
            putCount += 1;
            putIfMatchHeaders.push(request.headers()['if-match'] || '');
            if (putCount === 1) {
                remoteData = remoteChanged;
                remoteEtag = '"v2"';
                await route.fulfill({
                    status: 412,
                    contentType: 'application/json',
                    headers: etagHeaders(remoteEtag),
                    body: JSON.stringify({ ok: false, error: 'Precondition failed', etag: remoteEtag })
                });
                return;
            }
            remoteData = JSON.parse(request.postData() || '{}');
            remoteEtag = '"v3"';
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: etagHeaders(remoteEtag),
                body: JSON.stringify({ ok: true, etag: remoteEtag })
            });
            return;
        }
        await route.fulfill({ status: 404, body: '' });
    });

    await page.addInitScript(({ value, remoteHash }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
            webdavUrl: 'https://sync-etag.example.test',
            username: '',
            password: '',
            remotePath: '/life-plan.json',
            autoSync: false
        }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({ remotePath: '/apps/wheel-app/data.json', autoSync: false }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({
            dirty: true,
            lastLocalHash: '',
            lastRemoteHash: remoteHash,
            lastRemoteEtag: '"v1"',
            lastSyncAt: '',
            lastPullAt: '',
            lastPushAt: '',
            lastConflictAt: ''
        }));
    }, { value: localData, remoteHash: hashData(remoteBase) });

    await page.goto('/');
    await page.evaluate(() => runCloudSync('up'));

    expect(getCount).toBe(2);
    expect(putCount).toBe(2);
    expect(putIfMatchHeaders).toEqual(['"v1"', '"v2"']);
    expect(remoteData.todos.map(todo => todo.id).sort()).toEqual([
        'local-new-todo',
        'remote-new-todo',
        'shared-remote-todo'
    ]);
    const syncState = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSyncState')));
    expect(syncState.dirty).toBe(false);
    expect(syncState.lastRemoteEtag).toBe('"v3"');
});

test('auto sync does not upload unchanged data on reload', async ({ page }) => {
    const data = createEmptyData({
        habitCurrencies: [
            {
                id: 'habit-currency-default',
                name: '金币',
                createdAt: '2026-07-07T10:00:00',
                updatedAt: '2026-07-07T10:00:00'
            }
        ]
    });
    const hash = hashData(data);
    let getCount = 0;
    let putCount = 0;

    await page.route('https://sync.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === '/life-plan.json' && request.method() === 'GET') {
            getCount += 1;
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
            return;
        }
        if (url.pathname === '/life-plan.json' && request.method() === 'PUT') {
            putCount += 1;
            await route.fulfill({ status: 204, body: '' });
            return;
        }
        await route.fulfill({ status: 404, body: '' });
    });

    await page.addInitScript(({ value, valueHash }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
            webdavUrl: 'https://sync.example.test',
            username: '',
            password: '',
            remotePath: '/life-plan.json',
            autoSync: true
        }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({ remotePath: '/apps/wheel-app/data.json', autoSync: false }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({
            dirty: false,
            lastLocalHash: valueHash,
            lastRemoteHash: valueHash,
            lastSyncAt: '',
            lastPullAt: '',
            lastPushAt: '',
            lastConflictAt: ''
        }));
    }, { value: data, valueHash: hash });

    await page.goto('/');
    await expect.poll(() => getCount).toBeGreaterThan(0);
    await expect(page.locator('#sync-status-inline')).toContainText('同步：已同步');
    await page.waitForTimeout(200);

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.habitCurrencies[0].createdAt).toBe('2026-07-07T10:00:00');
    expect(putCount).toBe(0);
});

test('auto sync records matching remote hash instead of uploading first seen identical data', async ({ page }) => {
    const data = createEmptyData({
        habitCurrencies: [
            {
                id: 'habit-currency-default',
                name: '金币',
                createdAt: '2026-07-07T10:00:00',
                updatedAt: '2026-07-07T10:00:00'
            }
        ]
    });
    const hash = hashData(data);
    let getCount = 0;
    let putCount = 0;

    await page.route('https://sync.example.test/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === '/life-plan.json' && request.method() === 'GET') {
            getCount += 1;
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
            return;
        }
        if (url.pathname === '/life-plan.json' && request.method() === 'PUT') {
            putCount += 1;
            await route.fulfill({ status: 204, body: '' });
            return;
        }
        await route.fulfill({ status: 404, body: '' });
    });

    await page.addInitScript(({ value }) => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
        localStorage.setItem('lifePlanSyncConfig', JSON.stringify({
            webdavUrl: 'https://sync.example.test',
            username: '',
            password: '',
            remotePath: '/life-plan.json',
            autoSync: true
        }));
        localStorage.setItem('lifePlanWheelSyncConfig', JSON.stringify({ remotePath: '/apps/wheel-app/data.json', autoSync: false }));
        localStorage.setItem('lifePlanSyncState', JSON.stringify({
            dirty: false,
            lastLocalHash: '',
            lastRemoteHash: '',
            lastSyncAt: '',
            lastPullAt: '',
            lastPushAt: '',
            lastConflictAt: ''
        }));
    }, { value: data });

    await page.goto('/');
    await expect.poll(() => getCount).toBeGreaterThan(0);
    await expect(page.locator('#sync-status-inline')).toContainText('同步：已同步');
    await page.waitForTimeout(200);

    const syncState = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSyncState')));
    expect(syncState.lastRemoteHash).toBe(hash);
    expect(syncState.dirty).toBe(false);
    expect(putCount).toBe(0);
});

test('record merge keeps the longer diary when an old backup is a prefix', async ({ page }) => {
    const oldDiary = {
        id: 'diary-2026-07-07',
        type: '日记',
        title: '2026年7月7日 星期二',
        content: '# 正文\n早上记录\n\n# 复盘\n',
        createdAt: '2026-07-07T10:06:57',
        updatedAt: '2026-07-07T14:50:01'
    };
    const newDiary = {
        ...oldDiary,
        content: '# 正文\n早上记录。晚上追加了一段重要内容。\n\n# 复盘\n',
        updatedAt: '2026-07-07T18:49:59'
    };

    await page.goto('/');
    const merged = await page.evaluate(({ localData, remoteData }) => {
        return mergeCloudData(localData, remoteData);
    }, {
        localData: createEmptyData({ records: [newDiary] }),
        remoteData: createEmptyData({ records: [oldDiary] })
    });

    expect(merged.records).toHaveLength(1);
    expect(merged.records[0].id).toBe('diary-2026-07-07');
    expect(merged.records[0].content).toBe(newDiary.content);
    expect(merged.records[0].updatedAt).toBe('2026-07-07T18:49:59');
});

test('record merge creates a conflict copy when diary text diverges', async ({ page }) => {
    const localDiary = {
        id: 'diary-diverged',
        type: '日记',
        title: '2026年7月7日 星期二',
        content: '# 正文\n共同开头。本地补了一句。\n\n# 复盘\n',
        createdAt: '2026-07-07T10:06:57',
        updatedAt: '2026-07-07T18:40:00'
    };
    const remoteDiary = {
        ...localDiary,
        content: '# 正文\n共同开头。云端补了另一句。\n\n# 复盘\n',
        updatedAt: '2026-07-07T18:45:00'
    };

    await page.goto('/');
    const merged = await page.evaluate(({ localData, remoteData }) => {
        return mergeCloudData(localData, remoteData);
    }, {
        localData: createEmptyData({ records: [localDiary] }),
        remoteData: createEmptyData({ records: [remoteDiary] })
    });

    const primary = merged.records.find(record => record.id === 'diary-diverged');
    const conflict = merged.records.find(record => record.conflictOf === 'diary-diverged');
    expect(primary.content).toBe(remoteDiary.content);
    expect(conflict).toBeTruthy();
    expect(conflict.content).toBe(localDiary.content);
    expect(conflict.title).toContain('冲突副本');
});

test('merge keeps local item when matching remote item has no reliable timestamp', async ({ page }) => {
    const localTodo = {
        id: 'todo-missing-stamp',
        text: '本地较新的待办内容',
        done: false,
        subTodos: [],
        sessions: []
    };
    const remoteTodo = {
        id: 'todo-missing-stamp',
        text: '旧备份里的待办内容',
        done: false,
        subTodos: [],
        sessions: []
    };

    await page.goto('/');
    const merged = await page.evaluate(({ localData, remoteData }) => {
        return mergeCloudData(localData, remoteData);
    }, {
        localData: createEmptyData({ todos: [localTodo] }),
        remoteData: createEmptyData({ todos: [remoteTodo] })
    });

    expect(merged.todos).toHaveLength(1);
    expect(merged.todos[0].text).toBe(localTodo.text);
});

test('record merge keeps local primary and creates conflict copy when both timestamps are missing', async ({ page }) => {
    const localDiary = {
        id: 'diary-missing-stamp',
        type: '日记',
        title: '没有时间戳的日记',
        content: '# 正文\n本地追加了新的复盘内容。\n'
    };
    const remoteDiary = {
        ...localDiary,
        content: '# 正文\n旧备份里写了另一段内容。\n'
    };

    await page.goto('/');
    const merged = await page.evaluate(({ localData, remoteData }) => {
        return mergeCloudData(localData, remoteData);
    }, {
        localData: createEmptyData({ records: [localDiary] }),
        remoteData: createEmptyData({ records: [remoteDiary] })
    });

    const primary = merged.records.find(record => record.id === 'diary-missing-stamp');
    const conflict = merged.records.find(record => record.conflictOf === 'diary-missing-stamp');
    expect(primary.content).toBe(localDiary.content);
    expect(conflict).toBeTruthy();
    expect(conflict.content).toBe(remoteDiary.content);
    expect(conflict.title).toContain('冲突副本');
});

test('manual import keeps newer local data when importing an old backup', async ({ page }) => {
    const oldDiary = {
        id: 'manual-import-diary',
        type: '日记',
        title: '手动导入日记',
        content: '# 正文\n旧备份内容\n',
        createdAt: '2026-07-07T10:00:00',
        updatedAt: '2026-07-07T11:00:00'
    };
    const newDiary = {
        ...oldDiary,
        content: '# 正文\n当前浏览器里的新内容\n',
        updatedAt: '2026-07-07T18:00:00'
    };
    const localTodo = {
        id: 'manual-import-unstamped-todo',
        text: '当前浏览器里的无时间戳待办',
        done: false,
        subTodos: [],
        sessions: []
    };
    const backupTodo = {
        ...localTodo,
        text: '旧备份里的无时间戳待办'
    };
    const localData = createEmptyData({ records: [newDiary], todos: [localTodo] });
    const backupData = createEmptyData({ records: [oldDiary], todos: [backupTodo] });

    await page.addInitScript(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), localData);
    await page.goto('/');

    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '导入恢复' }).click();
    const chooser = await chooserPromise;
    const confirmDialog = page.waitForEvent('dialog');
    await chooser.setFiles({
        name: 'old-main-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(backupData), 'utf-8')
    });
    const confirm = await confirmDialog;
    expect(confirm.message()).toContain('导入会安全合并');
    await confirm.accept();
    const successDialog = await page.waitForEvent('dialog');
    expect(successDialog.message()).toContain('导入成功');
    await successDialog.accept();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records.find(record => record.id === 'manual-import-diary').content).toBe(newDiary.content);
    expect(stored.todos.find(todo => todo.id === 'manual-import-unstamped-todo').text).toBe(localTodo.text);
    const snapshots = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'));
    expect(snapshots.some(snapshot => snapshot.reason === '导入安全合并前')).toBe(true);
    expect(snapshots.some(snapshot => snapshot.reason === '导入安全合并结果')).toBe(true);
});

test('manual import creates a conflict copy for divergent diary content', async ({ page }) => {
    const localDiary = {
        id: 'manual-import-diverged-diary',
        type: '日记',
        title: '手动导入冲突日记',
        content: '# 正文\n当前浏览器补了一句。\n',
        createdAt: '2026-07-07T10:00:00',
        updatedAt: '2026-07-07T18:30:00'
    };
    const backupDiary = {
        ...localDiary,
        content: '# 正文\n备份文件补了另一句。\n',
        updatedAt: '2026-07-07T18:35:00'
    };

    await page.addInitScript(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), createEmptyData({ records: [localDiary] }));
    await page.goto('/');

    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '导入恢复' }).click();
    const chooser = await chooserPromise;
    const confirmDialog = page.waitForEvent('dialog');
    await chooser.setFiles({
        name: 'diverged-main-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(createEmptyData({ records: [backupDiary] })), 'utf-8')
    });
    const confirm = await confirmDialog;
    await confirm.accept();
    const successDialog = await page.waitForEvent('dialog');
    await successDialog.accept();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const primary = stored.records.find(record => record.id === 'manual-import-diverged-diary');
    const conflict = stored.records.find(record => record.conflictOf === 'manual-import-diverged-diary');
    expect(primary.content).toBe(backupDiary.content);
    expect(conflict).toBeTruthy();
    expect(conflict.content).toBe(localDiary.content);
    expect(conflict.title).toContain('冲突副本');
});

test('merge keeps tombstoned entities deleted instead of reviving stale remote data', async ({ page }) => {
    const deletedAt = '2026-07-08T10:00:00';
    const staleStamp = '2026-07-07T10:00:00';
    const remoteData = createEmptyData({
        todos: [{ id: 'deleted-todo', text: '旧待办', updatedAt: staleStamp, done: false, subTodos: [], sessions: [] }],
        habits: [{ id: 'deleted-habit', name: '旧习惯', updatedAt: staleStamp }],
        templates: [{ id: 'deleted-template', name: '旧模板', updatedAt: staleStamp }],
        goals: [{ id: 'deleted-goal', name: '旧目标', updatedAt: staleStamp }],
        wheels: [
            {
                id: 'wheel-main',
                name: '普通转盘',
                mode: 'normal',
                updatedAt: staleStamp,
                items: [{ id: 'deleted-wheel-item', name: '旧选项', updatedAt: staleStamp, weight: 1, enabled: true }]
            }
        ]
    });
    const localData = createEmptyData({
        wheels: [{ id: 'wheel-main', name: '普通转盘', mode: 'normal', updatedAt: deletedAt, items: [] }],
        deletedItems: [
            { collection: 'todos', id: 'deleted-todo', deletedAt },
            { collection: 'habits', id: 'deleted-habit', deletedAt },
            { collection: 'templates', id: 'deleted-template', deletedAt },
            { collection: 'goals', id: 'deleted-goal', deletedAt },
            { collection: 'wheelItems', id: 'deleted-wheel-item', deletedAt, wheelId: 'wheel-main' }
        ]
    });

    await page.goto('/');
    const merged = await page.evaluate(({ localData, remoteData }) => {
        return mergeCloudData(localData, remoteData);
    }, { localData, remoteData });

    expect(merged.todos).toHaveLength(0);
    expect(merged.habits).toHaveLength(0);
    expect(merged.templates).toHaveLength(0);
    expect(merged.goals).toHaveLength(0);
    expect(merged.wheels[0].items).toHaveLength(0);
    expect(merged.deletedItems.map(item => `${item.collection}:${item.id}`)).toEqual(expect.arrayContaining([
        'todos:deleted-todo',
        'habits:deleted-habit',
        'templates:deleted-template',
        'goals:deleted-goal',
        'wheelItems:deleted-wheel-item'
    ]));
});

test('wheel snapshot merge keeps deleted wheel items from returning', async ({ page }) => {
    const deletedAt = '2026-07-08T10:00:00';
    const localSnapshot = {
        wheels: [{ id: 'wheel-main', name: '普通转盘', mode: 'normal', updatedAt: deletedAt, items: [] }],
        wheelTags: [],
        wheelLibraryItems: [],
        wheelHistory: [],
        deletedItems: [{ collection: 'wheelItems', id: 'deleted-wheel-item', deletedAt, wheelId: 'wheel-main' }]
    };
    const remoteSnapshot = {
        wheels: [
            {
                id: 'wheel-main',
                name: '普通转盘',
                mode: 'normal',
                updatedAt: '2026-07-07T10:00:00',
                items: [{ id: 'deleted-wheel-item', name: '旧选项', updatedAt: '2026-07-07T10:00:00', weight: 1, enabled: true }]
            }
        ],
        wheelTags: [],
        wheelLibraryItems: [],
        wheelHistory: []
    };

    await page.goto('/');
    const merged = await page.evaluate(({ localSnapshot, remoteSnapshot }) => {
        return mergeWheelSnapshots(localSnapshot, remoteSnapshot);
    }, { localSnapshot, remoteSnapshot });

    expect(merged.wheels[0].items).toHaveLength(0);
    expect(merged.deletedItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'wheelItems', id: 'deleted-wheel-item' })
    ]));
});

test('global search page accepts a keyword', async ({ page }) => {
    await page.goto('/');
    await page.locator('.nav-item', { hasText: '全局搜索' }).click();
    await page.locator('#global-search-input').fill('工作');
    await expect(page.locator('#global-search-results')).toBeVisible();
});

test('global search input debounces repeated rendering while typing', async ({ page }) => {
    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, createEmptyData({
        todos: [
            {
                id: 'search-debounce-todo',
                text: 'abc search target',
                note: '',
                done: false,
                dueDate: '',
                planStartDate: '',
                planEndDate: '',
                urgency: 'medium',
                group: '工作',
                subTodos: [],
                sessions: [],
                createdAt: '2026-07-14T10:00:00',
                updatedAt: '2026-07-14T10:00:00'
            }
        ]
    }));
    await page.goto('/');
    await page.locator('.nav-item', { hasText: '全局搜索' }).click();
    await page.evaluate(() => { window.__lifePlanSearchRenderCount = 0; });
    await page.locator('#global-search-input').focus();
    await page.keyboard.type('abc', { delay: 20 });
    await expect(page.locator('#global-search-results')).toContainText('abc search target');
    const renderCount = await page.evaluate(() => window.__lifePlanSearchRenderCount);
    expect(renderCount).toBe(1);
});

test('AI settings are saved outside main life plan data', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'AI 设置' }).click();
    await expect(page.locator('#ai-settings-modal')).toHaveClass(/active/);
    await page.locator('#ai-remote-enabled').check();
    await page.locator('#ai-endpoint-url').fill('https://ai2.hhhl.cc/v1');
    await page.locator('#ai-api-key').fill('test-key');
    await page.locator('#ai-model').fill('test-model');
    await page.locator('#ai-user-style').fill('短句，偏行动');
    await page.getByRole('button', { name: '保存设置' }).click();

    const savedConfig = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanAiConfig')));
    const mainData = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(savedConfig).toMatchObject({
        endpointUrl: 'https://ai2.hhhl.cc/v1',
        apiKey: 'test-key',
        model: 'test-model',
        remoteEnabled: true,
        userStyle: '短句，偏行动'
    });
    expect(JSON.stringify(mainData)).not.toContain('test-key');
    await expect(page.locator('#ai-key-storage-status')).toContainText('API Key 已保存在本浏览器本地');
    await expect(page.locator('#ai-settings-status')).toContainText('API Key 已保存在本浏览器本地');
});

test('AI API key can be cleared without resetting the rest of the configuration', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('lifePlanAiConfig', JSON.stringify({
            endpointUrl: 'https://ai2.hhhl.cc/v1',
            apiKey: 'test-key',
            model: 'test-model',
            remoteEnabled: true,
            userStyle: '短句，偏行动'
        }));
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'AI 设置' }).click();
    await expect(page.locator('#ai-api-key')).toHaveValue('test-key');
    await page.getByRole('button', { name: '清除 Key' }).click();

    const savedConfig = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanAiConfig')));
    expect(savedConfig).toMatchObject({
        endpointUrl: 'https://ai2.hhhl.cc/v1',
        model: 'test-model',
        remoteEnabled: true,
        userStyle: '短句，偏行动'
    });
    expect(savedConfig.apiKey).toBe('');
    await expect(page.locator('#ai-api-key')).toHaveValue('');
    await expect(page.locator('#ai-key-storage-status')).toContainText('未保存 API Key');
    await expect(page.locator('#ai-settings-status')).toContainText('API Key 已从本浏览器本地配置中清除');
});

test('AI remote calls accept an OpenAI-compatible base URL', async ({ page }) => {
    const data = createEmptyData({
        todos: [
            {
                id: 'remote-ai-todo',
                text: '验证 CCS 模型接入',
                note: '',
                done: false,
                dueDate: '',
                planStartDate: '',
                planEndDate: '',
                urgency: 'medium',
                group: '工作',
                subTodos: [],
                sessions: []
            }
        ]
    });
    const requests = [];
    await page.route('https://ai2.hhhl.cc/v1/chat/completions', async route => {
        requests.push(route.request().postDataJSON());
        await new Promise(resolve => setTimeout(resolve, 150));
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                title: '远程 AI 建议',
                                summary: '通过 Base URL 请求成功',
                                items: [{ text: '用 CCS 模型生成行动项', note: '远程返回', group: '工作', urgency: 'medium' }]
                            })
                        }
                    }
                ]
            })
        });
    });

    await page.goto('/');
    await page.evaluate(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
        localStorage.setItem('lifePlanAiConfig', JSON.stringify({
            endpointUrl: 'https://ai2.hhhl.cc/v1',
            apiKey: 'test-key',
            model: 'ccs-test-model',
            remoteEnabled: true,
            userStyle: ''
        }));
    }, data);
    await page.reload();
    await page.getByRole('button', { name: 'AI 今日计划' }).click();
    await expect(page.locator('#ai-assistant-modal')).not.toContainText('AI 设置');
    await page.getByRole('button', { name: '生成建议' }).click();
    await expect(page.locator('#ai-run-button')).toHaveClass(/is-loading/);
    await expect(page.locator('#ai-run-button')).toContainText('生成中');

    await expect(page.locator('#ai-result-panel')).toContainText('用 CCS 模型生成行动项');
    await expect(page.locator('#ai-run-button')).not.toHaveClass(/is-loading/);
    expect(requests).toHaveLength(1);
    expect(requests[0].model).toBe('ccs-test-model');
});

test('AI local today plan can create actionable todos', async ({ page }) => {
    const data = createEmptyData({
        todos: [
            {
                id: 'ai-overdue',
                text: '完成 AI 接入方案',
                note: '先做最小可用版本',
                done: false,
                dueDate: '2026-07-06',
                planStartDate: '',
                planEndDate: '',
                urgency: 'high',
                group: '工作',
                subTodos: [],
                sessions: []
            }
        ],
        goals: [{ id: 'goal-ai', name: '打磨人生规划系统', period: '本周', target: '提高可用性', status: '进行中', progress: 40 }]
    });

    await page.goto('/');
    await page.evaluate(value => {
        localStorage.removeItem('lifePlanAiConfig');
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, data);
    await page.reload();
    await page.getByRole('button', { name: 'AI 今日计划' }).click();
    await page.locator('#ai-user-input').fill('今天先把可验证的部分做完');
    await page.getByRole('button', { name: '生成建议' }).click();
    await expect(page.locator('#ai-result-panel')).toContainText('完成 AI 接入方案');

    // Can add only the first suggestion via per-item button.
    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已加入待办 1 项');
        dialog.accept();
    });
    await page.locator('#ai-result-panel .ai-result-item').first().getByRole('button', { name: '加入待办' }).click();

    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    let aiTodos = stored.todos.filter(todo => todo.sourceType === 'ai');
    expect(aiTodos).toHaveLength(1);
    expect(aiTodos[0].text).toContain('完成 AI 接入方案');
    expect(aiTodos[0].planStartDate).toBeTruthy();

    // Uncheck all, then batch button should refuse empty selection.
    const checkboxes = page.locator('#ai-result-panel .ai-result-item input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i += 1) {
        await checkboxes.nth(i).uncheck();
    }
    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('请至少选择一条 AI 建议');
        dialog.accept();
    });
    await page.getByRole('button', { name: '加入今日待办' }).click();

    // Check only the first and batch-add again (may create another todo with same text).
    await checkboxes.first().check();
    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已加入待办 1 项');
        dialog.accept();
    });
    await page.getByRole('button', { name: '加入今日待办' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    aiTodos = stored.todos.filter(todo => todo.sourceType === 'ai');
    expect(aiTodos).toHaveLength(2);
});

test('AI local breakdown writes subtodos to the selected todo', async ({ page }) => {
    const data = createEmptyData({
        todos: [
            {
                id: 'ai-breakdown',
                text: '整理 AI 助手交互',
                note: '需要可配置、可落地',
                done: false,
                dueDate: '',
                planStartDate: '',
                planEndDate: '',
                urgency: 'medium',
                group: '工作',
                subTodos: [],
                sessions: []
            }
        ]
    });

    await page.goto('/');
    await page.evaluate(value => {
        localStorage.removeItem('lifePlanAiConfig');
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, data);
    await page.reload();
    await page.getByRole('button', { name: 'AI 今日计划' }).click();
    await page.getByRole('button', { name: '拆解待办' }).click();
    await page.getByRole('button', { name: '生成建议' }).click();
    await expect(page.locator('#ai-result-panel')).toContainText('整理 AI 助手交互');

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已写入子任务');
        dialog.accept();
    });
    await page.getByRole('button', { name: '写入子任务' }).click();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const todo = stored.todos.find(item => item.id === 'ai-breakdown');
    expect(todo.subTodos.length).toBeGreaterThanOrEqual(3);
    expect(todo.note).toContain('AI 拆解');
});

test('AI diary analysis writes review and todos only after confirmation', async ({ page }) => {
    const data = createEmptyData({
        records: [
            {
                id: 'diary-ai-record',
                type: '日记',
                title: '日记 AI 试水',
                content: [
                    '# 正文',
                    '今天日记里写了项目节奏有点乱，但晚上终于把关键问题想明白了。',
                    '',
                    '# 今日一句话',
                    '把复杂事情收回到一条线',
                    '',
                    '# 高兴',
                    '下午把卡住的地方讲清楚了。',
                    '',
                    '# 思考',
                    '先做能落地的一小步。',
                    '',
                    '# 小确幸',
                    '',
                    '',
                    '# 待改进',
                    '',
                    '',
                    '# 复盘',
                    '',
                    '',
                    '# 明日重点',
                    ''
                ].join('\n'),
                startDate: '2026-07-07',
                endDate: '2026-07-07',
                recordTime: '21:30',
                templateId: 'builtin-diary-daily-review',
                todoIds: [],
                createdAt: '2026-07-07 21:30',
                updatedAt: '2026-07-07 21:30'
            }
        ]
    });

    await page.goto('/');
    await page.evaluate(value => {
        localStorage.removeItem('lifePlanAiConfig');
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, data);
    await page.reload();
    await page.getByRole('button', { name: 'AI 今日计划' }).click();
    await page.getByRole('button', { name: '日记分析' }).click();
    await expect(page.locator('#ai-context-panel')).toContainText('日记 AI 试水');
    await page.getByRole('button', { name: '生成建议' }).click();
    await expect(page.locator('#ai-result-panel')).toContainText('写入复盘 + 明日重点');
    await expect(page.locator('#ai-capture-draft-diary-review')).toHaveValue(/今天的核心线索/);
    await page.locator('#ai-capture-draft-diary-review').fill('编辑后的复盘：今天先把 AI 日记分析写入链路做稳。');
    await page.locator('#ai-capture-draft-diary-tomorrow').fill('编辑后的明日重点：先验证写入后的内容可回读。');
    await page.locator('#ai-capture-draft-diary-todo-text-0').fill('编辑后的待办：确认日记 AI 可写前编辑');
    await page.locator('#ai-capture-draft-diary-todo-note-0').fill('先改草稿再落库，避免直接写入原文');
    await page.locator('#ai-capture-draft-diary-todo-plan-start-0').fill('2026-07-10');
    await page.locator('#ai-capture-draft-diary-todo-plan-end-0').fill('2026-07-11');
    await page.locator('#ai-capture-draft-diary-todo-due-0').fill('2026-07-11');

    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records[0].content).not.toContain('今天的核心线索');

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已写入');
        dialog.accept();
    });
    await page.getByRole('button', { name: '写入复盘 + 明日重点' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const diary = stored.records.find(record => record.id === 'diary-ai-record');
    expect(diary.content).toContain('# 复盘');
    expect(diary.content).toContain('编辑后的复盘');
    expect(diary.content).toContain('# 明日重点');
    expect(diary.content).toContain('编辑后的明日重点');

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已创建待办');
        dialog.accept();
    });
    await page.getByRole('button', { name: '创建这些待办' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const todo = stored.todos.find(item => item.sourceType === 'diary-ai');
    const updatedDiary = stored.records.find(record => record.id === 'diary-ai-record');
    expect(todo.text).toContain('编辑后的待办');
    expect(todo.note).toContain('先改草稿再落库');
    expect(todo.planStartDate).toBe('2026-07-10');
    expect(todo.planEndDate).toBe('2026-07-11');
    expect(todo.dueDate).toBe('2026-07-11');
    expect(updatedDiary.todoIds).toContain(todo.id);
});

test('AI diary analysis splits weekend plans and keeps editable dates', async ({ page }) => {
    const data = createEmptyData({
        records: [
            {
                id: 'diary-weekend-record',
                type: '日记',
                title: '周末打算',
                content: [
                    '# 正文',
                    '这个周末有两个打算嘛，一个就是做一下断舍离，实在不行就开着空调做，另一个就是把床垫子都重新整一下，因为感觉有点儿快变形了。',
                    '',
                    '# 今日一句话',
                    '把家务集中到周末',
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
                    '',
                    '',
                    '# 明日重点',
                    ''
                ].join('\n'),
                startDate: '2026-07-22',
                endDate: '2026-07-22',
                recordTime: '21:10',
                templateId: 'builtin-diary-daily-review',
                todoIds: [],
                createdAt: '2026-07-22 21:10',
                updatedAt: '2026-07-22 21:10'
            }
        ]
    });

    await page.goto('/');
    await page.evaluate(value => {
        localStorage.removeItem('lifePlanAiConfig');
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, data);
    await page.reload();
    await page.getByRole('button', { name: 'AI 今日计划' }).click();
    await page.getByRole('button', { name: '日记分析' }).click();
    await page.getByRole('button', { name: '生成建议' }).click();

    await expect(page.locator('#ai-result-panel')).toContainText('建议待办');
    await expect(page.locator('#ai-capture-draft-diary-todo-text-0')).toHaveValue(/断舍离/);
    await expect(page.locator('#ai-capture-draft-diary-todo-text-1')).toHaveValue(/床垫/);
    await expect(page.locator('#ai-result-panel')).toContainText('识别时间：本周末');

    const planStart0 = page.locator('#ai-capture-draft-diary-todo-plan-start-0');
    const planEnd0 = page.locator('#ai-capture-draft-diary-todo-plan-end-0');
    await expect(planStart0).not.toHaveValue('');
    const startValue = await planStart0.inputValue();
    const endValue = await planEnd0.inputValue();
    expect(startValue <= endValue).toBeTruthy();
    // Should not force "today" when diary says weekend; on 2026-07-22 (Wed) weekend is 25-26.
    const todayStr = await page.evaluate(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    });
    if (todayStr === '2026-07-22') {
        await expect(planStart0).toHaveValue('2026-07-25');
        await expect(planEnd0).toHaveValue('2026-07-26');
    }

    await page.locator('#ai-capture-draft-diary-todo-text-0').fill('断舍离（可编辑）');
    await page.locator('#ai-capture-draft-diary-todo-plan-start-0').fill('2026-07-26');
    await page.locator('#ai-capture-draft-diary-todo-plan-end-0').fill('2026-07-26');
    await page.locator('#ai-capture-draft-diary-todo-due-0').fill('2026-07-26');

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已创建待办');
        dialog.accept();
    });
    await page.getByRole('button', { name: '创建这些待办' }).click();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const diaryTodos = stored.todos.filter(item => item.sourceType === 'diary-ai');
    expect(diaryTodos.length).toBeGreaterThanOrEqual(2);
    const declutter = diaryTodos.find(item => item.text.includes('断舍离'));
    const mattress = diaryTodos.find(item => item.text.includes('床垫'));
    expect(declutter).toBeTruthy();
    expect(mattress).toBeTruthy();
    expect(declutter.planStartDate).toBe('2026-07-26');
    expect(declutter.dueDate).toBe('2026-07-26');
    expect(mattress.planStartDate).toBeTruthy();
    // Unedited second item should keep AI-resolved weekend range, not collapse to empty.
    expect(mattress.planEndDate).toBeTruthy();
    expect(mattress.planStartDate <= mattress.planEndDate).toBeTruthy();
});

test('AI chat capture drafts can be edited before writing', async ({ page }) => {
    const data = createEmptyData();

    await page.goto('/');
    await page.evaluate(value => {
        localStorage.removeItem('lifePlanAiConfig');
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, data);
    await page.reload();

    await page.getByRole('button', { name: 'AI 今日计划' }).click();
    await page.getByRole('button', { name: '对话整理', exact: true }).click();
    await page.locator('#ai-user-input').fill('明天项把 AI 对话整理接到日记里，待办：检查页面加载效果。这个想法先放灵感池。');
    await page.getByRole('button', { name: '生成建议' }).click();

    await expect(page.locator('#ai-result-panel')).toContainText('日记草稿');
    await expect(page.locator('#ai-capture-draft-diaryText')).toHaveValue(/AI 对话整理/);
    await expect(page.locator('#ai-result-panel')).toContainText('建议待办');
    await page.locator('#ai-capture-draft-todo-text-0').fill('检查首屏加载动效（已编辑）');
    await page.locator('#ai-capture-draft-todo-note-0').fill('按钮上需要有明确加载反馈');
    await page.locator('#ai-capture-draft-workText').fill('编辑后的工作记录：AI 对话整理已经跑通。');
    await page.locator('#ai-capture-draft-planText').fill('编辑后的日计划：明天先检查页面加载效果。');
    await page.locator('#ai-capture-draft-ideaText').fill('编辑后的灵感：把对话整理做成轻量收集入口。');
    await page.locator('#ai-capture-draft-diaryText').fill('编辑后的日记：今天把 AI 对话整理接进来了。');

    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.todos).toHaveLength(0);
    expect(stored.records).toHaveLength(0);

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已创建待办');
        dialog.accept();
    });
    await page.getByRole('button', { name: '创建这些待办' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const editedTodo = stored.todos.find(todo => todo.sourceType === 'ai-capture');
    expect(editedTodo.text).toContain('检查首屏加载动效');
    expect(editedTodo.note).toContain('明确加载反馈');
    expect(stored.records).toHaveLength(0);

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已创建工作记录');
        dialog.accept();
    });
    await page.getByRole('button', { name: '创建工作记录' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const workRecord = stored.records.find(record => record.type === '工作记录');
    expect(workRecord.content).toContain('编辑后的工作记录');

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已创建日计划');
        dialog.accept();
    });
    await page.getByRole('button', { name: '写入日计划' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const plan = stored.records.find(record => record.type === '日计划');
    expect(plan.content).toContain('编辑后的日计划');

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已创建灵感碎片');
        dialog.accept();
    });
    await page.getByRole('button', { name: '存为灵感' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const idea = stored.records.find(record => record.type === '灵感碎片');
    expect(idea.content).toContain('编辑后的灵感');
    expect(idea.ideaTags).toContain('AI整理');

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('日记');
        dialog.accept();
    });
    await page.getByRole('button', { name: '追加到日记' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const diary = stored.records.find(record => record.type === '日记');
    expect(diary.templateId).toBe('builtin-diary-daily-review');
    expect(diary.content).toContain('# 正文');
    expect(diary.content).toContain('编辑后的日记');
});

test('idea can be converted to an editable linked todo', async ({ page }) => {
    const sample = require('../test-data/sample-data.json');
    const data = JSON.parse(JSON.stringify(sample));
    data.todos = data.todos.filter(todo => todo.id !== 'sample-todo-idea');
    const idea = data.records.find(record => record.id === 'sample-record-idea');
    idea.ideaTodoId = '';
    idea.ideaStatus = '待整理';
    idea.content = '这是一个很长很长的灵感正文，里面有很多背景、限制、上下文和暂时还没有整理过的句子，不应该直接塞进待办标题里。'.repeat(3);
    idea.title = '';
    idea.ideaNextAction = '';

    await page.goto('/');
    await page.evaluate(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), data);
    await page.reload();
    await page.locator('.nav-item', { hasText: '灵感池' }).click();
    await page.locator('.idea-card', { hasText: '这是一个很长很长的灵感正文' }).getByRole('button', { name: '转成待办' }).click();

    const modal = page.locator('#todo-detail-modal');
    await expect(modal).toHaveClass(/active/);
    await expect(page.locator('#todo-detail-title')).toHaveText('灵感转待办');
    await expect(modal.locator('#todo-detail-edit-panel')).toBeVisible();
    await expect(modal.locator('#todo-detail-text')).toHaveValue('实践一条灵感');

    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.records.find(record => record.id === 'sample-record-idea').ideaTodoId).toBe('');
    const todoCountBeforeCancel = stored.todos.length;

    await modal.getByRole('button', { name: '取消' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.todos).toHaveLength(todoCountBeforeCancel);
    expect(stored.records.find(record => record.id === 'sample-record-idea').ideaTodoId).toBe('');

    await page.locator('.idea-card', { hasText: '这是一个很长很长的灵感正文' }).getByRole('button', { name: '转成待办' }).click();
    await expect(modal).toHaveClass(/active/);

    await modal.locator('#todo-detail-text').fill('验证灵感的最小实验');
    await modal.locator('#todo-detail-note').fill('先做 15 分钟版本，保留原始正文在灵感里');
    await modal.getByRole('button', { name: '保存' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const updatedIdea = stored.records.find(record => record.id === 'sample-record-idea');
    const linkedTodo = stored.todos.find(todo => todo.id === updatedIdea.ideaTodoId);
    expect(updatedIdea.ideaStatus).toBe('待实践');
    expect(linkedTodo.text).toBe('验证灵感的最小实验');
    expect(linkedTodo.note).toContain('15 分钟');
});

test('todo detail supports completion, notes and checkable subtodos in view mode', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('lifePlanData'));
    await page.reload();

    await page.locator('[data-page-target="todos"]').click();
    await page.getByRole('button', { name: '+ 新建通用待办' }).click();
    const modal = page.locator('#todo-detail-modal');
    await modal.locator('#todo-detail-text').fill('整理项目上下文');
    await modal.locator('#todo-detail-note').fill('后续补充参考链接和执行注意事项');
    await modal.locator('#new-subtodo-input').fill('列出下一步');
    await modal.getByRole('button', { name: '添加' }).click();
    await modal.getByRole('button', { name: '保存' }).click();

    await page.locator('.todo-title-cell', { hasText: '整理项目上下文' }).click();
    await expect(modal.locator('.todo-detail-note')).toContainText('后续补充参考链接');
    await expect(modal.locator('#todo-detail-edit-panel')).toBeHidden();
    await modal.getByRole('button', { name: '标记完成' }).click();
    await expect(modal.getByRole('button', { name: '恢复未完成' })).toBeVisible();
    await modal.getByRole('button', { name: '恢复未完成' }).click();
    await expect(modal.getByRole('button', { name: '标记完成' })).toBeVisible();
    const subTodo = modal.locator('.todo-subtodo-item', { hasText: '列出下一步' });
    await expect(subTodo.locator('input[type="checkbox"]')).toBeEnabled();
    await subTodo.locator('input[type="checkbox"]').check();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const todo = stored.todos.find(item => item.text === '整理项目上下文');
    expect(todo.note).toContain('参考链接');
    expect(todo.done).toBe(true);
    expect(todo.subTodos[0].done).toBe(true);
});

test('todo no-due preset clears plan start, plan end and due date', async ({ page }) => {
    const data = createEmptyData({
        todos: [{
            id: 'todo-planned',
            text: '有计划的待办',
            note: '',
            done: false,
            dueDate: '2026-07-21',
            planStartDate: '2026-07-20',
            planEndDate: '2026-07-22',
            urgency: 'medium',
            group: '其他',
            subTodos: [],
            sessions: [],
            createdAt: '2026-07-20 10:00',
            updatedAt: '2026-07-20 10:00'
        }]
    });

    await page.goto('/');
    await page.evaluate(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), data);
    await page.reload();
    await page.locator('[data-page-target="todos"]').click();
    await page.locator('.todo-title-cell', { hasText: '有计划的待办' }).click();

    const modal = page.locator('#todo-detail-modal');
    await modal.getByRole('button', { name: '编辑' }).click();
    await expect(modal.locator('#todo-detail-plan-start')).toHaveValue('2026-07-20');
    await expect(modal.locator('#todo-detail-plan-end')).toHaveValue('2026-07-22');
    await expect(modal.locator('#todo-detail-date')).toHaveValue('2026-07-21');

    await modal.getByRole('button', { name: '无截止', exact: true }).click();
    await expect(modal.locator('#todo-detail-plan-start')).toHaveValue('');
    await expect(modal.locator('#todo-detail-plan-end')).toHaveValue('');
    await expect(modal.locator('#todo-detail-date')).toHaveValue('');

    await modal.getByRole('button', { name: '保存' }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const todo = stored.todos.find(item => item.id === 'todo-planned');
    expect(todo.planStartDate).toBe('');
    expect(todo.planEndDate).toBe('');
    expect(todo.dueDate).toBe('');
});

test('verified ideas are listed after active ideas by default', async ({ page }) => {
    const data = createEmptyData({
        records: [
            {
                id: 'idea-verified-newer',
                type: '灵感碎片',
                title: '已经验证的较新灵感',
                content: '已经完成验证，不应该压在最前面。',
                startDate: '2026-07-07',
                endDate: '2026-07-07',
                todoIds: [],
                ideaStatus: '已验证',
                ideaTags: [],
                ideaNextAction: '',
                ideaTodoId: '',
                ideaConclusion: '验证完成'
            },
            {
                id: 'idea-active-older',
                type: '灵感碎片',
                title: '仍需推进的较旧灵感',
                content: '还需要处理。',
                startDate: '2026-07-01',
                endDate: '2026-07-01',
                todoIds: [],
                ideaStatus: '待实践',
                ideaTags: [],
                ideaNextAction: '',
                ideaTodoId: '',
                ideaConclusion: ''
            }
        ]
    });

    await page.goto('/');
    await page.evaluate(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), data);
    await page.reload();
    await page.locator('.nav-item', { hasText: '灵感池' }).click();

    await expect(page.locator('.idea-card h3')).toHaveText(['仍需推进的较旧灵感', '已经验证的较新灵感']);
    await page.locator('#idea-status-filter').selectOption('已验证');
    await expect(page.locator('.idea-card h3')).toHaveText(['已经验证的较新灵感']);
    await page.locator('#idea-status-filter').selectOption('待实践');
    await expect(page.locator('.idea-card h3')).toHaveText(['仍需推进的较旧灵感']);
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
        bodyMetrics: [],
        fitnessPlans: [],
        fitnessWorkouts: [],
        exerciseLibrary: [],
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
    await expect(page.locator('#wheel-action-menu-button')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#wheel-action-menu')).toBeHidden();

    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '修改当前盘' }).click();
    const itemsModal = page.locator('#wheel-items-modal');
    await expect(itemsModal).toHaveClass(/active/);
    const copyFilter = itemsModal.locator('.wheel-copy-filter');
    await copyFilter.getByRole('button', { name: /美食/ }).click();
    await expect(itemsModal.locator('#wheel-library-copy-select option')).toHaveText(['从公共项复制到当前转盘', '火锅']);

    await itemsModal.locator('#wheel-library-copy-select').selectOption('library-hotpot');
    await itemsModal.getByRole('button', { name: '复制' }).click();
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    let copied = stored.wheels[0].items.find(item => item.name === '火锅');
    expect(copied.sourceLibraryItemId).toBe('library-hotpot');

    await itemsModal.locator('#wheel-library-copy-select').selectOption('library-hotpot');
    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('同名选项');
        dialog.accept();
    });
    await itemsModal.getByRole('button', { name: '复制' }).click();

    await itemsModal.locator('.close-btn').click();
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '公共项库' }).click();
    const libraryModal = page.locator('#wheel-library-modal');
    await libraryModal.locator('#wheel-library-name').fill('周末晨跑拉伸');
    await libraryModal.getByRole('button', { name: 'AI 推荐标签' }).click();
    await expect(libraryModal.locator('.wheel-library-ai-tag')).toContainText(['运动']);
    await expect(libraryModal.locator('.wheel-library-batch-tag input[value="tag-sport"]')).toBeChecked();
    // Closing the library modal should clear transient AI recommendations and form drafts.
    await libraryModal.locator('.close-btn').click();
    await expect(libraryModal).not.toHaveClass(/active/);
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '公共项库' }).click();
    await expect(libraryModal.locator('.wheel-library-ai-tag')).toHaveCount(0);
    await expect(libraryModal.locator('#wheel-library-ai-box')).toContainText('输入公共项后点“AI 推荐标签”');
    await expect(libraryModal.locator('#wheel-library-name')).toHaveValue('');
    await expect(libraryModal.locator('#wheel-library-selected-count')).toContainText('选中 0');
    // Re-run AI recommendation and allow user edits before adding.
    await libraryModal.locator('#wheel-library-name').fill('周末晨跑拉伸');
    await libraryModal.getByRole('button', { name: 'AI 推荐标签' }).click();
    await expect(libraryModal.locator('.wheel-library-ai-tag')).toContainText(['运动']);
    await libraryModal.locator('.wheel-library-ai-tag', { hasText: '运动' }).locator('input').uncheck();
    await expect(libraryModal.locator('.wheel-library-batch-tag input[value="tag-sport"]')).not.toBeChecked();
    await libraryModal.locator('.wheel-library-batch-tag input[value="tag-food"]').check();
    await libraryModal.locator('#wheel-library-name').fill('寿司');
    await libraryModal.locator('#wheel-library-weight').fill('4');
    await libraryModal.getByRole('button', { name: '添加', exact: true }).click();
    await expect(libraryModal.locator('#wheel-library-name')).toHaveValue('');
    // Batch import only accepts trailing pure-number weight; tags come from checkbox only.
    await libraryModal.locator('#wheel-library-batch-text').fill('晨跑,2\n周末晨跑,2,运动\n麦当劳,肯德基,3');
    const acceptDialogs = async (checks = []) => {
        let index = 0;
        const done = new Promise(resolve => {
            const onDialog = async dialog => {
                const check = checks[index];
                if (check) expect(dialog.message()).toContain(check);
                index += 1;
                await dialog.accept();
                if (index >= checks.length) {
                    page.off('dialog', onDialog);
                    resolve();
                }
            };
            page.on('dialog', onDialog);
        });
        return done;
    };
    let dialogsDone = acceptDialogs(['将统一绑定标签：美食', '已导入公共项 3 项']);
    await libraryModal.getByRole('button', { name: '导入多行公共项' }).click({ noWaitAfter: true });
    await dialogsDone;
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelLibraryItems.find(item => item.name === '晨跑')?.weight).toBe(2);
    // "周末晨跑,2,运动" keeps the whole line as name because last token is not a number.
    expect(stored.wheelLibraryItems.find(item => item.name === '周末晨跑,2,运动')?.weight).toBe(1);
    expect(stored.wheelLibraryItems.find(item => item.name === '麦当劳,肯德基')?.weight).toBe(3);
    expect(stored.wheelLibraryItems.find(item => item.name === '晨跑')?.tagIds).toEqual(['tag-food']);
    await libraryModal.locator('#wheel-library-tag-filter').selectOption('tag-food');
    await expect(libraryModal.locator('.wheel-row.library')).toHaveCount(5);
    await expect(libraryModal.locator('.wheel-row.library')).toContainText(['火锅', '寿司', '晨跑', '周末晨跑,2,运动', '麦当劳,肯德基']);
    await libraryModal.getByLabel('选择火锅').check();
    // Selecting items should not rebuild the whole panel and jump scroll to top.
    await expect.poll(async () => libraryModal.locator('#wheel-library-list').evaluate(el => el.scrollTop)).toBeGreaterThanOrEqual(0);
    await libraryModal.locator('.wheel-library-batch-tag input[value="tag-sport"]').check();
    dialogsDone = acceptDialogs(['将添加：美食、运动', '已给 1 个公共项加上标签']);
    await libraryModal.getByRole('button', { name: '加标签' }).click({ noWaitAfter: true });
    await dialogsDone;
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelLibraryItems.find(item => item.name === '寿司').tagIds).toEqual(['tag-food']);
    // Only 火锅 was selected, so 晨跑 keeps the batch checkbox tags only.
    expect(stored.wheelLibraryItems.find(item => item.name === '晨跑').tagIds).toEqual(['tag-food']);
    expect(stored.wheelLibraryItems.find(item => item.id === 'library-hotpot').tagIds).toEqual(expect.arrayContaining(['tag-food', 'tag-sport']));
    await libraryModal.locator('#wheel-library-tag-filter').selectOption('tag-sport');
    // Selection count should show total selected (across filters), not only current filter view.
    await expect(libraryModal.locator('#wheel-library-selected-count')).toContainText('选中 1');
    await expect(libraryModal.locator('.wheel-row.library')).toHaveCount(2);
    await libraryModal.locator('.wheel-library-batch-tag input[value="tag-food"]').uncheck();
    await libraryModal.locator('.wheel-library-batch-tag input[value="tag-sport"]').check();
    await libraryModal.getByLabel('选择火锅').check();
    dialogsDone = acceptDialogs(['将移除：运动', '已从 1 个公共项去掉标签']);
    await libraryModal.getByRole('button', { name: '去标签' }).click({ noWaitAfter: true });
    await dialogsDone;
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelLibraryItems.find(item => item.id === 'library-hotpot').tagIds).toEqual(['tag-food']);
    await libraryModal.locator('#wheel-library-tag-filter').selectOption('tag-food');
    // Clear leftover cross-filter selection before the delete count assertion.
    await libraryModal.getByRole('button', { name: '清空勾选' }).click();
    await libraryModal.getByLabel('选择寿司').check();
    await libraryModal.getByLabel('选择晨跑').check();
    await expect(libraryModal.locator('#wheel-library-selected-count')).toContainText('选中 2');
    // Switch filter so UI visible count differs from bulk action count.
    await libraryModal.locator('#wheel-library-tag-filter').selectOption('tag-sport');
    await expect(libraryModal.locator('#wheel-library-selected-count')).toContainText('选中 2（当前筛选');
    await libraryModal.locator('#wheel-library-tag-filter').selectOption('tag-food');
    dialogsDone = acceptDialogs(['确定批量停用选中的 2 个公共项', '已批量停用 2 个公共项']);
    await libraryModal.getByRole('button', { name: '批量停用' }).click({ noWaitAfter: true });
    await dialogsDone;
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelLibraryItems.find(item => item.name === '寿司').enabled).toBe(false);
    expect(stored.wheelLibraryItems.find(item => item.name === '晨跑').enabled).toBe(false);
    dialogsDone = acceptDialogs(['删除选中的 2 个公共项']);
    await libraryModal.getByRole('button', { name: '批量删除' }).click({ noWaitAfter: true });
    await dialogsDone;
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelLibraryItems.some(item => item.name === '寿司')).toBe(false);
    expect(stored.wheelLibraryItems.some(item => item.name === '晨跑')).toBe(false);
    await libraryModal.locator('.close-btn').click();

    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '记录/备份' }).click();
    const historyModal = page.locator('#wheel-history-modal');
    await expect(historyModal.getByRole('button', { name: '导出记录' })).toBeVisible();
    const download = page.waitForEvent('download');
    await historyModal.getByRole('button', { name: '导出记录' }).click();
    await expect((await download).suggestedFilename()).toContain('大转盘抽取记录');

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheels[0].items.filter(item => item.name === '火锅')).toHaveLength(1);
});

function createWheelGestureData(wheelName = '手感测试盘') {
    return {
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
        bodyMetrics: [],
        fitnessPlans: [],
        fitnessWorkouts: [],
        exerciseLibrary: [],
        wheels: [
            {
                id: 'gesture-wheel',
                name: wheelName,
                mode: 'normal',
                items: [{ id: 'gesture-item', name: '手感结果', weight: 1, enabled: true }],
                createdAt: '2026-07-06 10:00',
                updatedAt: '2026-07-06 10:00'
            }
        ],
        wheelTags: [],
        wheelLibraryItems: [],
        wheelHistory: []
    };
}

test('wheel can be spun by clicking the canvas', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(value => {
        window.__wheelSpinDurationMs = 80;
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, createWheelGestureData('点击测试盘'));
    await page.reload();
    await page.evaluate(() => { window.__wheelSpinDurationMs = 80; });
    await page.locator('.nav-item', { hasText: '工具转盘' }).click();

    await page.locator('.wheel-canvas-wrap').click();
    await expect(page.locator('#wheel-result')).toContainText('手感结果', { timeout: 3000 });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelHistory).toHaveLength(1);
    expect(stored.wheelHistory[0].resultName).toBe('手感结果');
});

test('wheel can be spun by dragging the canvas', async ({ page }) => {
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
        bodyMetrics: [],
        fitnessPlans: [],
        fitnessWorkouts: [],
        exerciseLibrary: [],
        wheels: [
            {
                id: 'drag-wheel',
                name: '拖动测试盘',
                mode: 'normal',
                items: [{ id: 'drag-item', name: '拖动结果', weight: 1, enabled: true }],
                createdAt: '2026-07-06 10:00',
                updatedAt: '2026-07-06 10:00'
            }
        ],
        wheelTags: [],
        wheelLibraryItems: [],
        wheelHistory: []
    };

    await page.goto('/');
    await page.evaluate(value => {
        window.__wheelSpinDurationMs = 80;
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, data);
    await page.reload();
    await page.evaluate(() => { window.__wheelSpinDurationMs = 80; });
    await page.locator('.nav-item', { hasText: '工具转盘' }).click();

    const wheel = page.locator('.wheel-canvas-wrap');
    await wheel.scrollIntoViewIfNeeded();
    const box = await wheel.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.35, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator('#wheel-result')).toContainText('拖动结果', { timeout: 3000 });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelHistory).toHaveLength(1);
    expect(stored.wheelHistory[0].resultName).toBe('拖动结果');
});

test('tag wheel two-stage spin can be converted to a todo', async ({ page }) => {
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
        bodyMetrics: [],
        fitnessPlans: [],
        fitnessWorkouts: [],
        exerciseLibrary: [],
        wheels: [
            {
                id: 'tag-wheel',
                name: '标签晚餐盘',
                mode: 'tag',
                tagIds: ['tag-dinner'],
                items: [],
                createdAt: '2026-07-06 10:00',
                updatedAt: '2026-07-06 10:00'
            }
        ],
        wheelTags: [
            { id: 'tag-dinner', name: '晚餐', color: '#e86c52', weight: 1, enabled: true }
        ],
        wheelLibraryItems: [
            { id: 'library-noodle', name: '番茄牛肉面', weight: 1, enabled: true, tagIds: ['tag-dinner'] }
        ],
        wheelHistory: []
    };

    await page.goto('/');
    await page.evaluate(value => {
        window.__wheelSpinDurationMs = 80;
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, data);
    await page.reload();
    await page.evaluate(() => { window.__wheelSpinDurationMs = 80; });
    await page.locator('.nav-item', { hasText: '工具转盘' }).click();

    await page.getByRole('button', { name: '先抽一个标签' }).click();
    await expect(page.locator('#wheel-stage-summary')).toContainText('已锁定');
    await expect(page.locator('#wheel-stage-summary')).toContainText('晚餐');
    await expect(page.getByRole('button', { name: '继续抽具体内容' })).toBeVisible();

    await page.getByRole('button', { name: '继续抽具体内容' }).click();
    await expect(page.locator('#wheel-result')).toContainText('番茄牛肉面', { timeout: 3000 });

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已转入今日待办');
        dialog.accept();
    });
    await page.locator('#wheel-result').getByRole('button', { name: '转入待办' }).click();
    await expect(page.locator('#wheel-result').getByRole('button', { name: '已转入待办' })).toBeDisabled();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelHistory).toHaveLength(1);
    expect(stored.wheelHistory[0].mode).toBe('tag');
    expect(stored.wheelHistory[0].tagName).toBe('晚餐');
    expect(stored.wheelHistory[0].resultName).toBe('番茄牛肉面');
    expect(stored.wheelHistory[0].convertedTodoId).toBeTruthy();
    const linkedTodo = stored.todos.find(todo => todo.id === stored.wheelHistory[0].convertedTodoId);
    expect(linkedTodo.text).toBe('番茄牛肉面');
    expect(linkedTodo.sourceType).toBe('wheel');
});

test('wheel list modal filters by mode and can open edit delete', async ({ page }) => {
    const data = createEmptyData({
        wheels: [
            {
                id: 'wheel-normal-a',
                name: '普通盘A',
                mode: 'normal',
                items: [{ id: 'item-a', name: '喝茶', weight: 1, enabled: true }],
                createdAt: '2026-07-06 10:00',
                updatedAt: '2026-07-06 10:00'
            },
            {
                id: 'wheel-normal-b',
                name: '普通盘B',
                mode: 'normal',
                items: [{ id: 'item-b', name: '散步', weight: 1, enabled: true }],
                createdAt: '2026-07-06 11:00',
                updatedAt: '2026-07-06 11:00'
            },
            {
                id: 'wheel-tag-a',
                name: '标签盘A',
                mode: 'tag',
                tagIds: ['tag-food'],
                createdAt: '2026-07-06 12:00',
                updatedAt: '2026-07-06 12:00'
            }
        ],
        wheelTags: [
            { id: 'tag-food', name: '美食', color: '#e86c52', weight: 1, enabled: true }
        ],
        wheelLibraryItems: [
            { id: 'library-hotpot', name: '火锅', weight: 1, enabled: true, tagIds: ['tag-food'] }
        ],
        wheelHistory: []
    });

    await page.goto('/');
    await page.evaluate(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), data);
    await page.reload();
    await page.locator('.nav-item', { hasText: '工具转盘' }).click();
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();

    const listModal = page.locator('#wheel-list-modal');
    await expect(listModal).toHaveClass(/active/);
    await expect(listModal.locator('.wheel-list-card')).toHaveCount(2);
    await expect(listModal.locator('.wheel-list-card-title strong')).toHaveText(['普通盘B', '普通盘A']);

    await listModal.locator('#wheel-list-mode-filter').getByRole('button', { name: '标签' }).click();
    await expect(listModal.locator('.wheel-list-card')).toHaveCount(1);
    await expect(listModal.locator('.wheel-list-card-title strong')).toHaveText(['标签盘A']);

    await listModal.locator('#wheel-list-mode-filter').getByRole('button', { name: '普通' }).click();
    await listModal.locator('.wheel-list-card', { hasText: '普通盘B' }).getByRole('button', { name: '打开' }).click();
    await expect(listModal).not.toHaveClass(/active/);
    await expect(page.locator('#wheel-selector')).toHaveValue('wheel-normal-b');

    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();
    await listModal.locator('.wheel-list-card', { hasText: '普通盘A' }).getByRole('button', { name: '修改' }).click();
    await expect(listModal).not.toHaveClass(/active/);
    await expect(page.locator('#wheel-items-modal')).toHaveClass(/active/);
    await expect(page.locator('#wheel-selector')).toHaveValue('wheel-normal-a');
    await page.locator('#wheel-items-modal .close-btn').click();

    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '转盘列表' }).click();
    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('删除转盘');
        dialog.accept();
    });
    await listModal.locator('.wheel-list-card', { hasText: '普通盘B' }).getByRole('button', { name: '删除' }).click();
    await expect(listModal.locator('.wheel-list-card')).toHaveCount(1);
    await expect(listModal.locator('.wheel-list-card-title strong')).toHaveText(['普通盘A']);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheels.some(wheel => wheel.id === 'wheel-normal-b')).toBe(false);
});

test('normal wheel creation supports multiple items and batch textarea', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), createEmptyData({
        wheels: [],
        wheelTags: [],
        wheelLibraryItems: [],
        wheelHistory: []
    }));
    await page.reload();
    await page.locator('.nav-item', { hasText: '工具转盘' }).click();
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '新建转盘' }).click();

    const createModal = page.locator('#wheel-create-modal');
    await expect(createModal).toHaveClass(/active/);
    await createModal.locator('#wheel-create-name').fill('今晚吃什么');
    await createModal.locator('.wheel-create-item-row').first().locator('.wheel-create-item-name').fill('火锅');
    await createModal.locator('.wheel-create-item-row').first().locator('.wheel-create-item-weight').fill('10');
    await createModal.getByRole('button', { name: '+ 添加一项' }).click();
    await createModal.locator('.wheel-create-item-row').nth(1).locator('.wheel-create-item-name').fill('烧烤');
    await createModal.locator('.wheel-create-item-row').nth(1).locator('.wheel-create-item-weight').fill('5');
    await createModal.getByRole('button', { name: '批量添加' }).click();

    const batchModal = page.locator('#wheel-batch-modal');
    await expect(batchModal).toHaveClass(/active/);
    await batchModal.locator('#wheel-batch-text').fill('麦当劳\n火锅,2');
    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('跳过重复');
        dialog.accept();
    });
    await batchModal.getByRole('button', { name: '确认添加' }).click();
    await expect(createModal.locator('.wheel-create-item-row')).toHaveCount(3);
    await createModal.getByRole('button', { name: '创建并编辑' }).click();

    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const created = stored.wheels.find(wheel => wheel.name === '今晚吃什么');
    expect(created.mode).toBe('normal');
    expect(created.items.map(item => item.name)).toEqual(['火锅', '烧烤', '麦当劳']);
    expect(created.items.map(item => item.weight)).toEqual([10, 5, 1]);

    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '修改当前盘' }).click();
    const itemsModal = page.locator('#wheel-items-modal');
    await itemsModal.getByRole('button', { name: '批量导入' }).click();
    await batchModal.locator('#wheel-batch-text').fill('麻辣烫,3\n烧烤,9');
    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已导入 1 项');
        expect(dialog.message()).toContain('跳过重复');
        dialog.accept();
    });
    await batchModal.getByRole('button', { name: '确认添加' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const updated = stored.wheels.find(wheel => wheel.name === '今晚吃什么');
    expect(updated.items.map(item => item.name)).toEqual(['火锅', '烧烤', '麦当劳', '麻辣烫']);
    expect(updated.items.find(item => item.name === '麻辣烫').weight).toBe(3);
});

test('tag wheel can spin a single selected tag directly', async ({ page }) => {
    const data = createEmptyData({
        wheels: [
            {
                id: 'tag-wheel-direct',
                name: '晚饭标签盘',
                mode: 'tag',
                tagIds: ['tag-food', 'tag-home'],
                items: []
            }
        ],
        wheelTags: [
            { id: 'tag-food', name: '吃喝', color: '#e86c52', weight: 1, enabled: true },
            { id: 'tag-home', name: '在家', color: '#2f7d6d', weight: 1, enabled: true }
        ],
        wheelLibraryItems: [
            { id: 'item-noodle', name: '煮面', weight: 1, enabled: true, tagIds: ['tag-home'] },
            { id: 'item-hotpot', name: '火锅', weight: 1, enabled: true, tagIds: ['tag-food'] }
        ],
        wheelHistory: []
    });

    await page.addInitScript(value => {
        window.__wheelSpinDurationMs = 1;
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, data);
    await page.goto('/');
    await page.locator('.nav-item', { hasText: '工具转盘' }).click();
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '标签管理' }).click();

    const tagsModal = page.locator('#wheel-tags-modal');
    await tagsModal.locator('[data-wheel-tag-id="tag-home"] button', { hasText: '只转这个标签' }).click();
    await expect(page.locator('#wheel-result')).toContainText('煮面', { timeout: 3000 });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelHistory[0].tagName).toBe('在家');
    expect(stored.wheelHistory[0].resultName).toBe('煮面');
});

test('tag management can edit a tag once without repeated prompts', async ({ page }) => {
    const data = createEmptyData({
        wheels: [
            {
                id: 'tag-wheel-edit',
                name: '标签盘',
                mode: 'tag',
                tagIds: ['tag-home'],
                items: []
            }
        ],
        wheelTags: [
            { id: 'tag-home', name: '在家', color: '#2f7d6d', weight: 1, enabled: true }
        ],
        wheelLibraryItems: [
            { id: 'item-noodle', name: '煮面', weight: 1, enabled: true, tagIds: ['tag-home'] }
        ],
        wheelHistory: []
    });

    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, data);
    await page.goto('/');
    await page.locator('.nav-item', { hasText: '工具转盘' }).click();
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '标签管理' }).click();

    const tagsModal = page.locator('#wheel-tags-modal');
    await expect(tagsModal.locator('[data-wheel-tag-id="tag-home"] .wheel-tag-color-chip')).toContainText('#2f7d6d');
    await tagsModal.locator('[data-wheel-tag-id="tag-home"] button', { hasText: '修改' }).click();
    await expect(tagsModal.locator('#wheel-tag-name')).toHaveValue('在家');
    await tagsModal.locator('#wheel-tag-name').fill('宅家');
    await tagsModal.locator('#wheel-tag-weight').fill('3');
    await tagsModal.locator('#wheel-tag-color').fill('#ff6b6b');
    await tagsModal.getByRole('button', { name: '保存修改' }).click();
    await expect(tagsModal.locator('[data-wheel-tag-id="tag-home"]')).toContainText('宅家');
    await expect(tagsModal.locator('[data-wheel-tag-id="tag-home"] .wheel-tag-color-chip')).toContainText('#ff6b6b');
    await expect(tagsModal.locator('#wheel-tag-name')).toHaveValue('');
    await expect(tagsModal.getByRole('button', { name: '添加' })).toBeVisible();

    // New tags should get a random palette color, not always the same green.
    await tagsModal.locator('#wheel-tag-name').fill('新标签A');
    await tagsModal.getByRole('button', { name: '添加' }).click();
    await tagsModal.locator('#wheel-tag-name').fill('新标签B');
    await tagsModal.getByRole('button', { name: '添加' }).click();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelTags.find(tag => tag.id === 'tag-home')).toMatchObject({
        name: '宅家',
        weight: 3,
        color: '#ff6b6b'
    });
    const createdColors = stored.wheelTags
        .filter(tag => tag.name === '新标签A' || tag.name === '新标签B')
        .map(tag => tag.color);
    expect(createdColors).toHaveLength(2);
    expect(createdColors.every(color => /^#[0-9a-fA-F]{6}$/.test(color))).toBe(true);
});

test('tag wheel creation requires and saves selected tags', async ({ page }) => {
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
        bodyMetrics: [],
        fitnessPlans: [],
        fitnessWorkouts: [],
        exerciseLibrary: [],
        wheels: [
            {
                id: 'normal-wheel',
                name: '普通盘',
                mode: 'normal',
                items: [{ id: 'normal-item', name: '默认项', weight: 1, enabled: true }],
                createdAt: '2026-07-06 10:00',
                updatedAt: '2026-07-06 10:00'
            }
        ],
        wheelTags: [
            { id: 'tag-food', name: '美食', color: '#e86c52', weight: 1, enabled: true },
            { id: 'tag-sport', name: '运动', color: '#3e65b0', weight: 1, enabled: true }
        ],
        wheelLibraryItems: [
            { id: 'library-hotpot', name: '火锅', weight: 1, enabled: true, tagIds: ['tag-food'] },
            { id: 'library-run', name: '跑步', weight: 1, enabled: true, tagIds: ['tag-sport'] }
        ],
        wheelHistory: []
    };

    await page.goto('/');
    await page.evaluate(value => localStorage.setItem('lifePlanData', JSON.stringify(value)), data);
    await page.reload();
    await page.locator('.nav-item', { hasText: '工具转盘' }).click();
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '新建转盘' }).click();
    await page.locator('#wheel-create-modal').getByRole('button', { name: '标签转盘' }).click();
    await expect(page.locator('#wheel-create-tag-options')).toContainText('美食');
    await page.locator('#wheel-create-tag-options input[value="tag-sport"]').uncheck();
    await page.locator('#wheel-create-name').fill('只吃饭');
    await page.getByRole('button', { name: '创建并编辑' }).click();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const created = stored.wheels.find(wheel => wheel.name === '只吃饭');
    expect(created.mode).toBe('tag');
    expect(created.tagIds).toEqual(['tag-food']);
});

test('wheel backup restore normalizes duplicate tags and copied data boundaries', async ({ page }) => {
    const dirtyBackup = {
        wheels: [
            {
                id: 'dirty-normal',
                name: '重复名字',
                mode: 'normal',
                tagIds: ['tag-a'],
                items: [
                    { id: 'normal-a', name: '火锅', weight: 1, enabled: true },
                    { id: 'normal-b', name: '火锅', weight: 9, enabled: true },
                    { id: 'normal-c', name: '烤肉', weight: 2, enabled: true }
                ]
            },
            {
                id: 'dirty-tag',
                name: '重复名字',
                mode: 'tag',
                items: [{ id: 'should-drop', name: '不该保留', weight: 1, enabled: true }],
                tagIds: ['tag-a', 'tag-b', 'tag-a']
            }
        ],
        wheelTags: [
            { id: 'tag-a', name: '美食', color: '#e86c52', weight: 1, enabled: true },
            { id: 'tag-b', name: '美食', color: '#3e65b0', weight: 3, enabled: true }
        ],
        wheelLibraryItems: [
            { id: 'library-a', name: '咖啡', weight: 1, enabled: true, tagIds: ['tag-a', 'tag-b'] },
            { id: 'library-b', name: '咖啡', weight: 4, enabled: true, tagIds: ['tag-b'] },
            { id: 'library-orphan', name: '无标签项', weight: 1, enabled: true, tagIds: [] }
        ],
        wheelHistory: []
    };

    await page.goto('/');
    await page.locator('.nav-item', { hasText: '工具转盘' }).click();
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '记录/备份' }).click();
    const historyModal = page.locator('#wheel-history-modal');

    const chooserPromise = page.waitForEvent('filechooser');
    await historyModal.getByRole('button', { name: '恢复JSON' }).click();
    const chooser = await chooserPromise;
    const restoreConfirmDialog = page.waitForEvent('dialog');
    await chooser.setFiles({
        name: 'dirty-wheel-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(dirtyBackup), 'utf-8')
    });
    const confirmDialog = await restoreConfirmDialog;
    expect(confirmDialog.message()).toContain('会覆盖当前转盘');
    await confirmDialog.accept();
    const restoredDialog = page.waitForEvent('dialog');
    const dialog = await restoredDialog;
    expect(dialog.message()).toContain('已恢复');
    await dialog.accept();

    await expect(page.locator('#wheel-selector')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem('lifePlanData'));
        return stored.wheels.some(wheel => wheel.id === 'dirty-normal');
    })).toBe(true);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const normalWheel = stored.wheels.find(wheel => wheel.id === 'dirty-normal');
    const tagWheel = stored.wheels.find(wheel => wheel.id === 'dirty-tag');
    expect(normalWheel.tagIds).toBeUndefined();
    expect(normalWheel.items.map(item => item.name)).toEqual(['火锅', '烤肉']);
    expect(tagWheel.items).toHaveLength(0);
    expect(tagWheel.tagIds).toEqual(['tag-a']);
    expect(stored.wheelTags.map(tag => tag.name)).toEqual(['美食', '未分类']);
    expect(stored.wheelLibraryItems.map(item => item.name)).toEqual(['咖啡', '无标签项']);
    const uncategorizedTag = stored.wheelTags.find(tag => tag.name === '未分类');
    const orphan = stored.wheelLibraryItems.find(item => item.name === '无标签项');
    expect(orphan.tagIds).toEqual([uncategorizedTag.id]);
    expect(stored.wheels.map(wheel => wheel.name)).toEqual(['重复名字', '重复名字']);
    const snapshots = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'));
    expect(snapshots.some(snapshot => snapshot.reason === '大转盘恢复前自动快照')).toBe(true);
});

test('wheel backup restore can be cancelled before overwriting local wheel data', async ({ page }) => {
    const existingData = createEmptyData({
        wheels: [
            {
                id: 'existing-wheel',
                name: '保留的转盘',
                mode: 'normal',
                items: [{ id: 'existing-item', name: '原来的选项', weight: 1, enabled: true }]
            }
        ],
        wheelTags: [],
        wheelLibraryItems: [],
        wheelHistory: []
    });
    const backup = {
        wheels: [
            {
                id: 'incoming-wheel',
                name: '导入转盘',
                mode: 'normal',
                items: [{ id: 'incoming-item', name: '导入选项', weight: 1, enabled: true }]
            }
        ],
        wheelTags: [],
        wheelLibraryItems: [],
        wheelHistory: []
    };

    await page.addInitScript(value => {
        localStorage.setItem('lifePlanData', JSON.stringify(value));
    }, existingData);
    await page.goto('/');
    await page.locator('.nav-item', { hasText: '工具转盘' }).click();
    await page.locator('#wheel-action-menu-button').click();
    await page.locator('#wheel-action-menu').getByRole('button', { name: '记录/备份' }).click();
    const historyModal = page.locator('#wheel-history-modal');

    const chooserPromise = page.waitForEvent('filechooser');
    await historyModal.getByRole('button', { name: '恢复JSON' }).click();
    const chooser = await chooserPromise;
    const restoreConfirmDialog = page.waitForEvent('dialog');
    await chooser.setFiles({
        name: 'incoming-wheel-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(backup), 'utf-8')
    });
    const confirmDialog = await restoreConfirmDialog;
    expect(confirmDialog.message()).toContain('会覆盖当前转盘');
    await confirmDialog.dismiss();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheels.map(wheel => wheel.id)).toEqual(['existing-wheel']);
    expect(stored.wheels[0].items.map(item => item.name)).toEqual(['原来的选项']);
    const snapshots = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanSnapshots') || '[]'));
    expect(snapshots.some(snapshot => snapshot.reason === '大转盘恢复前自动快照')).toBe(false);
});
