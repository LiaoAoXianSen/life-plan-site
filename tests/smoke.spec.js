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
        ['目标管理', '#page-goals'],
        ['工具转盘', '#page-wheel']
    ];

    for (const [label, selector] of pages) {
        await page.locator('.nav-item', { hasText: label }).click();
        await expect(page.locator(selector)).toBeVisible();
    }

    expect(errors).toEqual([]);
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

test('global search page accepts a keyword', async ({ page }) => {
    await page.goto('/');
    await page.locator('.nav-item', { hasText: '全局搜索' }).click();
    await page.locator('#global-search-input').fill('工作');
    await expect(page.locator('#global-search-results')).toBeVisible();
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

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已加入待办');
        dialog.accept();
    });
    await page.getByRole('button', { name: '加入今日待办' }).click();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const aiTodos = stored.todos.filter(todo => todo.sourceType === 'ai');
    expect(aiTodos.length).toBeGreaterThan(0);
    expect(aiTodos[0].text).toContain('完成 AI 接入方案');
    expect(aiTodos[0].planStartDate).toBeTruthy();
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
    expect(diary.content).toContain('今天的核心线索');
    expect(diary.content).toContain('# 明日重点');
    expect(diary.content).toContain('明天先推进');

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已创建待办');
        dialog.accept();
    });
    await page.getByRole('button', { name: '创建这些待办' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const todo = stored.todos.find(item => item.sourceType === 'diary-ai');
    const updatedDiary = stored.records.find(record => record.id === 'diary-ai-record');
    expect(todo.text).toContain('把复杂事情收回到一条线');
    expect(todo.note).toContain('来源日记');
    expect(updatedDiary.todoIds).toContain(todo.id);
});

test('AI chat capture organizes free text and writes only after confirmation', async ({ page }) => {
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

    await expect(page.locator('#ai-result-panel')).toContainText('纠错整理');
    await expect(page.locator('#ai-result-panel')).toContainText('想把 AI 对话整理');
    await expect(page.locator('#ai-result-panel')).toContainText('建议待办');

    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.todos).toHaveLength(0);
    expect(stored.records).toHaveLength(0);

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已创建待办');
        dialog.accept();
    });
    await page.getByRole('button', { name: '创建这些待办' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.todos.some(todo => todo.sourceType === 'ai-capture' && todo.text.includes('检查页面加载效果'))).toBeTruthy();
    expect(stored.records).toHaveLength(0);

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已创建灵感碎片');
        dialog.accept();
    });
    await page.getByRole('button', { name: '存为灵感' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const idea = stored.records.find(record => record.type === '灵感碎片');
    expect(idea.content).toContain('灵感池');
    expect(idea.ideaTags).toContain('AI整理');

    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('日记');
        dialog.accept();
    });
    await page.getByRole('button', { name: '追加到日记' }).click();

    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    const diary = stored.records.find(record => record.type === '日记');
    expect(diary.content).toContain('# AI 对话整理');
    expect(diary.content).toContain('检查页面加载效果');
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
    await libraryModal.locator('#wheel-library-batch-text').fill('寿司,4,美食\n晨跑,2,运动');
    page.once('dialog', dialog => {
        expect(dialog.message()).toContain('已导入公共项 2 项');
        dialog.accept();
    });
    await libraryModal.getByRole('button', { name: '导入多行公共项' }).click();
    await libraryModal.locator('#wheel-library-tag-filter').selectOption('tag-food');
    await expect(libraryModal.locator('.wheel-row.library')).toHaveCount(2);
    await expect(libraryModal.locator('.wheel-row.library')).toContainText(['火锅', '寿司']);
    await libraryModal.getByLabel('选择火锅').check();
    await libraryModal.locator('#wheel-library-batch-tag').selectOption('tag-sport');
    await libraryModal.getByRole('button', { name: '添加到选中' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelLibraryItems.find(item => item.id === 'library-hotpot').tagIds).toEqual(expect.arrayContaining(['tag-food', 'tag-sport']));
    await libraryModal.locator('#wheel-library-tag-filter').selectOption('tag-sport');
    await expect(libraryModal.locator('.wheel-row.library')).toHaveCount(3);
    await libraryModal.locator('#wheel-library-batch-tag').selectOption('tag-sport');
    await libraryModal.getByRole('button', { name: '从选中移除' }).click();
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifePlanData')));
    expect(stored.wheelLibraryItems.find(item => item.id === 'library-hotpot').tagIds).toEqual(['tag-food']);
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
    const restoredDialog = page.waitForEvent('dialog');
    await chooser.setFiles({
        name: 'dirty-wheel-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(dirtyBackup), 'utf-8')
    });
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
});
