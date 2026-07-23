// ================== 数据层 ==================
        let data = {
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
            wheelHistory: []
        };

        let currentRecordId = null;
        let currentHabitId = null;
        let currentTodoId = null;
        let currentGoalId = null;
        let autoSaveTimer = null;
        let tempTodos = [];
        let editingHabitId = null;
        let currentRecordView = 'list';
        let recordCursorDate = getTodayStr();
        let dashboardTimelineRangeDays = 30;
        let recordListRangeDays = 30;
        let currentHabitView = 'today';
        let currentStructuredTemplateId = '';
        let currentTemplateFields = {};
        let currentPreviewRecordId = null;
        let currentPreviewDraft = null;
        let currentPreviewFromEditor = false;
        let isRecordDirty = false;
        let pendingHabitNoteContext = null;
        let currentMaterialId = null;
        let selectedMaterialRandomTags = [];
        let currentWheelId = null;
        let currentWheelMode = 'normal';
        let currentWheelPanel = 'items';
        let currentWheelResultId = null;
        const HABIT_DEFAULT_CURRENCY = '金币';
        const HABIT_MILESTONE_DAYS = [7, 15, 21, 30, 90, 180, 365];
        const HABIT_MILESTONE_LABELS = {
            7: '一周',
            15: '15天',
            21: '21天',
            30: '30天',
            90: '一个季度',
            180: '半年',
            365: '一年'
        };
        let recordsService = null;
        let todosService = null;
        let aiService = null;
        let syncConfig = {
            webdavUrl: '',
            remotePath: '/life-plan.json',
            autoSync: true
        };
        let wheelSyncConfig = {
            remotePath: '/apps/wheel-app/data.json',
            autoSync: true
        };
        let habitSyncConfig = {
            remotePath: '/apps/habit-app/data.json',
            autoSync: false,
            remoteUploadEnabled: false
        };
        let aiConfig = {
            endpointUrl: '',
            apiKey: '',
            model: 'gpt-4.1-mini',
            remoteEnabled: false,
            userStyle: ''
        };
        let currentAiMode = 'todayPlan';
        let aiLastResult = null;
        let currentAiSourceRecordId = '';
        let isAiAssistantRunning = false;
        let syncState = {
            dirty: false,
            lastLocalHash: '',
            lastRemoteHash: '',
            lastRemoteEtag: '',
            lastSyncAt: '',
            lastPullAt: '',
            lastPushAt: '',
            lastConflictAt: ''
        };
        let wheelSyncState = {
            dirty: false,
            lastLocalHash: '',
            lastRemoteHash: '',
            lastRemoteEtag: '',
            lastSyncAt: '',
            lastPullAt: '',
            lastPushAt: '',
            lastConflictAt: ''
        };
        let habitSyncState = {
            dirty: false,
            lastLocalHash: '',
            lastRemoteHash: '',
            lastRemoteEtag: '',
            lastSyncAt: '',
            lastPullAt: '',
            lastPushAt: '',
            lastConflictAt: '',
            lastRebuildAt: '',
            lastRebuildReason: ''
        };
        let suppressDirtyMark = false;
        let autoSyncTimer = null;
        let syncIntervalTimer = null;
        let wheelAutoSyncTimer = null;
        let wheelSyncIntervalTimer = null;
        let globalSearchDebounceTimer = null;
        let isCloudSyncing = false;
        let isWheelCloudSyncing = false;
        let pendingCloudSync = false;
        let pendingWheelCloudSync = false;
        let hasUnreliableLocalSave = false;
        let localSaveWarning = '';
        const CRITICAL_FAILURE_LOG_KEY = 'lifePlanCriticalFailures';
        const HABIT_APP_LOCAL_MIRROR_KEY = 'habitAppData';
        const HABIT_REMOTE_PREVIEW_COLLECTIONS = [
            'habits',
            'habitGroups',
            'habitRecords',
            'habitRewards',
            'habitRewardRecords',
            'habitFineRecords',
            'habitLedger',
            'habitCurrencies',
            'habitMilestones',
            'habitMilestoneClaims',
            'habitOverdueEvents',
            'habitMoodNotes',
            'habitTimeTasks',
            'deletedItems'
        ];
        const MAX_CRITICAL_FAILURES = 5;
        let habitAppLocalMirror = null;
        let habitAppLocalMirrorMeta = {
            dirty: false,
            lastRebuildAt: '',
            lastRebuildReason: '',
            lastError: ''
        };
        let habitRemotePreviewState = {
            status: 'idle',
            mode: 'pull',
            requestedAt: '',
            remotePath: '/apps/habit-app/data.json',
            error: '',
            local: null,
            remote: null,
            merged: null,
            risks: []
        };
        let isHabitRemotePreviewRunning = false;
        const syncService = window.LifePlanSyncService.create({
            appSyncKit: () => window.AppSyncKit,
            fetchImpl: (...args) => fetch(...args),
            getNowLocal: () => getLocalDateTimeStr(),
            normalizeHabitCurrency: value => normalizeHabitCurrency(value),
            defaultCurrency: HABIT_DEFAULT_CURRENCY
        });
        const snapshotService = window.LifePlanSnapshotService.create({
            storage: localStorage,
            key: 'lifePlanSnapshots',
            maxSnapshots: 20,
            schemaVersion: 2,
            genId: () => genId(),
            getHash: value => getDataHash(value),
            getNowLocal: () => getLocalDateTimeStr()
        });
        const habitService = window.LifePlanHabitService.create({
            getTodayStr: () => getTodayStr(),
            addDays: (date, amount) => addDays(date, amount),
            isHabitDueOnDate: (habit, date) => isHabitDueOnDate(habit, date),
            getHabitTargetCount: habit => getHabitTargetCount(habit),
            defaultCurrency: HABIT_DEFAULT_CURRENCY
        });
        const builtInTemplates = [
            {
                id: 'builtin-diary-daily-review',
                builtIn: true,
                name: '日记 · 日终复盘',
                type: '日记',
                description: '把一天拆成几个小入口，想到哪块就写哪块，最后自动合成正文。',
                fields: [
                    { id: 'body', label: '正文', placeholder: '先把今天最想直接写下来的内容放这里。', rows: 5 },
                    { id: 'oneLine', label: '今日一句话', placeholder: '用一句话给今天定个调。' },
                    { id: 'happy', label: '高兴', placeholder: '今天让我高兴的事是什么？' },
                    { id: 'thinking', label: '思考', placeholder: '今天有什么想明白、没想明白、值得继续想的？' },
                    { id: 'smallJoy', label: '小确幸', placeholder: '一个小但真实的好瞬间。' },
                    { id: 'improve', label: '待改进', placeholder: '哪里可以做得更轻松、更清楚、更好？' },
                    { id: 'review', label: '复盘', placeholder: '今天的行动、结果、原因和下一步。', rows: 5 },
                    { id: 'tomorrow', label: '明日重点', placeholder: '明天最重要的一件事。' }
                ]
            },
            {
                id: 'builtin-day-plan-focus',
                builtIn: true,
                name: '日计划 · 今日聚焦',
                type: '日计划',
                description: '先定重点，再安排行动，适合早上快速开一天。',
                fields: [
                    { id: 'focus', label: '今日重点', placeholder: '今天最重要的一件事是什么？' },
                    { id: 'mustDo', label: '必须完成', placeholder: '列出 1-3 件今天必须推进的事。', rows: 4 },
                    { id: 'schedule', label: '时间安排', placeholder: '大概几点做什么，不用写太细。', rows: 4 },
                    { id: 'energy', label: '状态提醒', placeholder: '今天需要注意精力、情绪或健康上的什么？' },
                    { id: 'avoid', label: '尽量避免', placeholder: '今天最容易分心或拖住你的是什么？' }
                ],
                todos: [
                    { text: '完成今日重点', done: false, group: '工作', isExclusive: true, subTodos: [] }
                ]
            },
            {
                id: 'builtin-weekly-review',
                builtIn: true,
                name: '周复盘 · 本周回看',
                type: '周复盘',
                description: '用几个固定问题把一周收住，不用每次从空白开始。',
                fields: [
                    { id: 'wins', label: '本周做得好的', placeholder: '哪些行动、选择或结果值得保留？', rows: 4 },
                    { id: 'problems', label: '本周卡住的', placeholder: '哪里反复消耗、拖延或没推进？', rows: 4 },
                    { id: 'learned', label: '重要思考', placeholder: '这周有什么新认知、提醒或判断？', rows: 4 },
                    { id: 'relationships', label: '关系与生活', placeholder: '和人、家庭、生活相关的感受或事件。' },
                    { id: 'nextWeek', label: '下周调整', placeholder: '下周最想调整的 1-3 件事。', rows: 4 }
                ]
            },
            {
                id: 'builtin-monthly-review',
                builtIn: true,
                name: '月复盘 · 月度整理',
                type: '月复盘',
                description: '适合月底做一次更大的整理，沉淀方向和下一步。',
                fields: [
                    { id: 'highlights', label: '本月高光', placeholder: '这个月最值得记住的事。', rows: 4 },
                    { id: 'progress', label: '目标进展', placeholder: '目标、习惯、项目分别推进到哪里了？', rows: 4 },
                    { id: 'lessons', label: '问题与教训', placeholder: '这个月暴露了哪些模式或问题？', rows: 4 },
                    { id: 'decisions', label: '重要决定', placeholder: '接下来要坚持、停止或改变什么？', rows: 4 },
                    { id: 'nextMonth', label: '下月重点', placeholder: '下个月最重要的方向和行动。', rows: 4 }
                ]
            },
            {
                id: 'builtin-idea-capture',
                builtIn: true,
                name: '灵感碎片 · 快速捕捉',
                type: '灵感碎片',
                description: '把突然冒出来的想法先接住，之后再决定要不要做。',
                fields: [
                    { id: 'idea', label: '想法本身', placeholder: '先原样写下来，不用整理。', rows: 4 },
                    { id: 'trigger', label: '触发来源', placeholder: '它是被什么人、事、书、视频或场景触发的？' },
                    { id: 'value', label: '可能价值', placeholder: '它可能解决什么问题，或者为什么让我在意？', rows: 3 },
                    { id: 'nextStep', label: '下一步', placeholder: '如果要继续，最小下一步是什么？' }
                ]
            },
            {
                id: 'builtin-work-log-daily',
                builtIn: true,
                name: '工作记录 · 今日推进',
                type: '工作记录',
                description: '记录今天真正推进了什么、卡在哪里，以及明天接着做什么。',
                fields: [
                    { id: 'done', label: '今日完成', placeholder: '今天实际完成了哪些事？可以写成项目符号。', rows: 4 },
                    { id: 'progress', label: '关键推进', placeholder: '哪个项目/任务有了实质进展？推进到了哪里？', rows: 4 },
                    { id: 'blocked', label: '遇到的问题', placeholder: '卡点、风险、没解决的问题是什么？需要谁或什么资源？', rows: 4 },
                    { id: 'communication', label: '沟通/会议', placeholder: '今天和谁沟通了什么？有什么结论或待跟进？', rows: 3 },
                    { id: 'outputs', label: '产出链接/文件', placeholder: '代码、文档、截图、链接、交付物放这里。', rows: 3 },
                    { id: 'focusTime', label: '专注/用时', placeholder: '大概投入了多久？哪些时间最有效？' },
                    { id: 'tomorrow', label: '明日接续', placeholder: '明天打开电脑后第一件要接着做的是什么？', rows: 3 }
                ]
            }
        ];

        function getBuiltInTemplate(id) {
            return builtInTemplates.find(t => t.id === id);
        }

        function composeTemplateContent(template, values = {}) {
            if (!template?.fields) return template?.content || '';
            return template.fields.map(field => {
                const text = (values[field.id] || '').trim();
                return `# ${field.label}\n${text || ''}`;
            }).join('\n\n') + '\n';
        }

        function parseTemplateContent(template, content = '') {
            if (!template?.fields) return {};
            const sectionMap = new Map(
                parseRecordContentSections(content).map(section => [
                    String(section.title || '').trim(),
                    section.body.join('\n').trim()
                ])
            );
            const values = {};
            template.fields.forEach(field => {
                values[field.id] = sectionMap.get(field.label) || '';
            });
            return values;
        }

        function updateRecordContentNote(template) {
            const note = document.getElementById('record-content-note');
            if (!note) return;

            if (!template?.fields) {
                note.classList.remove('active');
                note.textContent = '';
                return;
            }

            note.classList.add('active');
            note.textContent = '上面的折叠项负责输入，下面的内容区只展示自动汇总后的结果，方便你通看整体效果。';
        }

        function updateRecordContentMode(template) {
            const label = document.getElementById('record-content-label');
            const textarea = document.getElementById('record-content');
            if (!label || !textarea) return;

            if (template?.fields) {
                label.textContent = '内容';
                textarea.readOnly = true;
                textarea.classList.add('is-preview');
                textarea.placeholder = '这里会显示自动汇总后的完整内容';
            } else {
                label.textContent = '正文内容';
                textarea.readOnly = false;
                textarea.classList.remove('is-preview');
                textarea.placeholder = '记录详细内容...';
            }
        }

        function renderStructuredTemplateEditor(template, values = {}) {
            const container = document.getElementById('built-in-template-editor');
            if (!container) return;

            if (!template?.fields) {
                container.classList.remove('active');
                container.innerHTML = '';
                updateRecordContentNote(null);
                updateRecordContentMode(null);
                return;
            }

            container.classList.add('active');
            updateRecordContentNote(template);
            updateRecordContentMode(template);
            container.innerHTML = `
                <div class="template-editor-head">
                    <div>
                        <div class="template-editor-title">${escapeHtml(template.name)} · 分块填写</div>
                        <div class="template-editor-meta">${escapeHtml(template.description || '每一块默认折叠，展开后填写，正文会自动同步生成。')}</div>
                    </div>
                    <div class="template-editor-actions">
                        <button type="button" onclick="toggleTemplateFields(true)">全部展开</button>
                        <button type="button" onclick="toggleTemplateFields(false)">全部收起</button>
                        <button type="button" onclick="clearStructuredTemplateFields()">清空</button>
                    </div>
                </div>
                ${template.fields.map(field => `
                    <details class="template-field">
                        <summary>${escapeHtml(field.label)}</summary>
                        <textarea
                            rows="${field.rows || 3}"
                            data-template-field="${escapeHtml(field.id)}"
                            placeholder="${escapeHtml(field.placeholder || '')}"
                            oninput="updateStructuredTemplateField(${escapeJsArg(field.id)}, this.value)"
                        >${escapeHtml(values[field.id] || '')}</textarea>
                    </details>
                `).join('')}
            `;
        }

        function resetStructuredTemplateEditor() {
            currentStructuredTemplateId = '';
            currentTemplateFields = {};
            renderStructuredTemplateEditor(null);
        }

        function toggleTemplateFields(open) {
            document.querySelectorAll('#built-in-template-editor .template-field').forEach(field => {
                field.open = open;
            });
        }

        function scheduleRecordAutoSave() {
            isRecordDirty = true;
            autoSaveRecord();
        }

        function handleRecordTypeChange() {
            autoFillDateRange();
            updateIdeaFieldsVisibility();
            scheduleRecordAutoSave();
        }

        function clearStructuredTemplateFields() {
            const template = getBuiltInTemplate(currentStructuredTemplateId);
            if (!template) return;
            if (!confirm('清空当前模板里已填写的内容吗？')) return;

            currentTemplateFields = {};
            renderStructuredTemplateEditor(template, currentTemplateFields);
            document.getElementById('record-content').value = composeTemplateContent(template, currentTemplateFields);
            scheduleRecordAutoSave();
        }

        function updateStructuredTemplateField(fieldId, value) {
            currentTemplateFields[fieldId] = value;
            const template = getBuiltInTemplate(currentStructuredTemplateId);
            if (template) {
                document.getElementById('record-content').value = composeTemplateContent(template, currentTemplateFields);
                scheduleRecordAutoSave();
            }
        }

        const IDEA_STATUS_OPTIONS = ['待整理', '待实践', '实践中', '已验证', '已放弃'];
        const IDEA_UNPROCESSED_STATUSES = new Set(['待整理', '待实践']);
        const MATERIAL_TYPES = ['金句', '提示词', '摘抄', '观点', '方法'];

        function normalizeTagList(value = []) {
            const raw = Array.isArray(value) ? value : String(value || '').split(/[,，、;；/\s]+/);
            return Array.from(new Set(
                raw.map(tag => String(tag || '').trim()).filter(Boolean)
            ));
        }

        function tagsToInput(tags = []) {
            return normalizeTagList(tags).join(', ');
        }

        function hasMatchingTag(tags = [], query = '') {
            const clean = String(query || '').trim().toLowerCase();
            if (!clean) return true;
            return normalizeTagList(tags).some(tag => tag.toLowerCase().includes(clean));
        }

        function getIdeaStatus(record) {
            return recordsService.getIdeaStatus(record);
        }

        function getIdeaTags(record) {
            return recordsService.getIdeaTags(record);
        }

        function getIdeaTodo(record) {
            return record?.ideaTodoId ? data.todos.find(todo => todo.id === record.ideaTodoId) : null;
        }

        function isIdeaUnprocessed(record) {
            return recordsService.isIdeaUnprocessed(record);
        }

        function ideaNeedsConclusion(record) {
            return recordsService.ideaNeedsConclusion(record);
        }

        // 初始化
        function init() {
            loadData();
            loadSyncState();
            loadWheelSyncState();
            updateSidebarToolState(true);
            syncTimelineRangeControls();
            renderTodayDate();
            renderDashboard();
            renderHabitTabs();
            initYearSelect();
            if (data.habits.length > 0) {
                currentHabitId = data.habits[0].id;
            }
            renderHabitPage();
            renderHabitRewards();
            renderHabitCurrencyOptions();
            settleYesterdayHabitPenalties();
        }

        function updateSidebarToolState(force = false) {
            const panel = document.querySelector('.sidebar-bottom');
            if (!panel) return;
            const shouldOpen = window.innerWidth > 980;
            if (force || shouldOpen) panel.open = shouldOpen;
        }

        // 加载本地数据
        function loadData() {
            const saved = localStorage.getItem('lifePlanData');
            if (saved) {
                try {
                    data = { ...data, ...JSON.parse(saved) };
                } catch (err) {
                    alert('本地数据读取失败，请先导出当前文件备份后再处理');
                }
            }
            normalizeDataShape();
            const normalized = JSON.stringify(data);
            if (saved !== normalized) {
                persistLocalValue('lifePlanData', normalized, '初始化数据规范化');
            }
            loadSyncConfig();
            loadWheelSyncConfig();
            loadHabitSyncConfig();
            loadAiConfig();
            loadHabitAppLocalMirror();
            loadHabitSyncState();
        }

        function getHabitLegacySourceHash(source = data) {
            const slice = habitService.getHabitLegacySourceSlice
                ? habitService.getHabitLegacySourceSlice(source)
                : {
                    habits: source.habits || [],
                    checkins: source.checkins || [],
                    habitPointLedger: source.habitPointLedger || [],
                    habitRewards: source.habitRewards || [],
                    habitCurrencies: source.habitCurrencies || [],
                    deletedItems: source.deletedItems || []
                };
            return getDataHash(slice);
        }

        function loadHabitAppLocalMirror() {
            try {
                const saved = localStorage.getItem(HABIT_APP_LOCAL_MIRROR_KEY);
                habitAppLocalMirror = saved ? JSON.parse(saved) : null;
                habitAppLocalMirrorMeta.lastError = '';
            } catch (err) {
                habitAppLocalMirror = null;
                habitAppLocalMirrorMeta.lastError = err?.message || String(err);
                console.warn('habit-app 本地镜像读取失败', err);
            }
            return habitAppLocalMirror;
        }

        function getHabitAppLocalMirrorSummary() {
            return habitService.summarizeHabitAppLocalMirror(
                habitAppLocalMirror,
                getHabitLegacySourceHash()
            );
        }

        function saveHabitAppLocalMirror(snapshot, meta = {}) {
            if (!snapshot || typeof snapshot !== 'object') return false;
            const payload = {
                ...snapshot,
                localMirror: true,
                remoteUploadEnabled: false
            };
            if (!persistLocalValue(HABIT_APP_LOCAL_MIRROR_KEY, JSON.stringify(payload), 'habit-app 本地镜像')) {
                habitAppLocalMirrorMeta.lastError = '本地镜像写入失败';
                return false;
            }
            habitAppLocalMirror = payload;
            habitAppLocalMirrorMeta.dirty = false;
            habitAppLocalMirrorMeta.lastRebuildAt = payload.mirror?.rebuiltAt || payload.generatedAt || getLocalDateTimeStr();
            habitAppLocalMirrorMeta.lastRebuildReason = meta.reason || payload.mirror?.reason || '';
            habitAppLocalMirrorMeta.lastError = '';
            habitSyncState.dirty = false;
            habitSyncState.lastLocalHash = payload.mirror?.sourceHash || getHabitLegacySourceHash();
            habitSyncState.lastRebuildAt = habitAppLocalMirrorMeta.lastRebuildAt;
            habitSyncState.lastRebuildReason = habitAppLocalMirrorMeta.lastRebuildReason;
            saveHabitSyncState();
            return true;
        }

        function rebuildHabitAppLocalMirror(reason = 'manual-rebuild', options = {}) {
            const sourceHash = getHabitLegacySourceHash();
            const built = habitService.buildHabitAppLocalMirror(data, {
                reason,
                sourceHash,
                generatedAt: new Date().toISOString(),
                dualWriteEnabledPaths: habitService.getHabitDualWritePathInventory()
                    .filter(item => item.dualWrite === 'enabled')
                    .map(item => item.id)
            });
            const saved = saveHabitAppLocalMirror(built.snapshot, { reason });
            if (!saved) return null;
            if (options.renderDiagnostics && currentHabitView === 'diagnostics') {
                renderHabitDiagnosticsPanel();
            }
            return built;
        }

        function dualWriteHabitAppLocalMirror(reason = 'habit-write') {
            const built = rebuildHabitAppLocalMirror(reason);
            if (!built) {
                habitAppLocalMirrorMeta.dirty = true;
                console.warn('habit-app 本地双写失败', reason);
                return false;
            }
            return true;
        }

        function renderLocalSaveWarning() {
            const container = document.getElementById('local-save-warning');
            if (!container) return;
            container.classList.toggle('active', hasUnreliableLocalSave);
            container.querySelector('.local-save-warning-text').textContent = localSaveWarning || '';
            if (hasUnreliableLocalSave) {
                container.closest('details')?.setAttribute('open', '');
            }
        }

        function getCriticalFailures() {
            try {
                const saved = localStorage.getItem(CRITICAL_FAILURE_LOG_KEY);
                const parsed = saved ? JSON.parse(saved) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch (err) {
                console.warn('关键故障记录读取失败', err);
                return [];
            }
        }

        function renderCriticalFailureLog() {
            const container = document.getElementById('critical-failure-log');
            if (!container) return;
            const failures = getCriticalFailures();
            container.innerHTML = failures.map(item => `
                <div class="critical-failure-item">
                    <strong>${escapeHtml(item.label || '关键操作失败')}</strong>
                    <span>${escapeHtml(formatStoredDateTime(item.createdAt))} · ${escapeHtml(item.message || '未记录详细原因')}</span>
                </div>
            `).join('');
        }

        function recordCriticalFailure(label, err = null, extra = {}) {
            const entry = {
                id: genId(),
                label,
                message: err?.message || extra.message || '操作失败',
                createdAt: getLocalDateTimeStr(),
                action: extra.action || ''
            };
            try {
                const failures = [entry, ...getCriticalFailures()].slice(0, MAX_CRITICAL_FAILURES);
                localStorage.setItem(CRITICAL_FAILURE_LOG_KEY, JSON.stringify(failures));
            } catch (logErr) {
                console.warn('关键故障记录写入失败', logErr);
            }
            console.error(label, err || entry.message);
            renderCriticalFailureLog();
        }

        function persistLocalValue(key, value, label = '本地数据') {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (err) {
                const quotaExceeded = err?.name === 'QuotaExceededError' || err?.code === 22;
                localSaveWarning = quotaExceeded
                    ? `${label}未可靠保存：浏览器存储空间不足。请先导出备份或清理旧快照。`
                    : `${label}未可靠保存：浏览器本地存储写入失败。请先导出备份。`;
                hasUnreliableLocalSave = true;
                recordCriticalFailure(`${label}写入失败`, err, { action: 'local-storage-write' });
                renderLocalSaveWarning();
                updateSyncStatus(localSaveWarning, true);
                return false;
            }
        }

        function normalizeWheelColor(value, fallback = '#216e4e') {
            const color = String(value || '').trim();
            return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
        }

        function retryLocalSave() {
            if (!saveData()) return;
            hasUnreliableLocalSave = false;
            localSaveWarning = '';
            renderLocalSaveWarning();
            updateSyncStatus('本地数据已重新保存');
        }

        function openSnapshotRecovery() {
            openSnapshotModal();
        }

        function normalizeTodoTextKeyLocal(value = '') {
            if (todosService?.normalizeTodoTextKey) return todosService.normalizeTodoTextKey(value);
            return String(value || '')
                .toLowerCase()
                .replace(/[（(].*?[）)]/g, '')
                .replace(/[\s\u3000"'“”‘’`~!@#$%^&*+=|\\/?:;,.，。！？、·…\-_/<>\[\]{}]+/g, '')
                .trim();
        }

        function normalizeDataShape(target = data) {
            if (!target || typeof target !== 'object') return data;
            ['records','todos','habits','checkins','habitPointLedger','habitRewards','habitCurrencies','templates','goals','deletedItems','materials','bodyMetrics','fitnessPlans','fitnessWorkouts','exerciseLibrary','wheels','wheelTags','wheelLibraryItems','wheelHistory'].forEach(key => {
                if (!Array.isArray(target[key])) target[key] = [];
            });
            target.habitCurrencies = normalizeHabitCurrencyList(target.habitCurrencies, target);
            pruneDeletedItems(target);
            target.records = target.records.filter(record => !record?.isHabitRecord);
            target.todos.forEach(t => {
                if (!Array.isArray(t.subTodos)) t.subTodos = [];
                if (!Array.isArray(t.sessions)) t.sessions = [];
                if (!t.group) t.group = '其他';
                if (typeof t.note !== 'string') t.note = '';
                if (!TODO_URGENCY_META[t.urgency]) t.urgency = 'medium';
                if (typeof t.dueDate !== 'string') t.dueDate = '';
                if (typeof t.planStartDate !== 'string') t.planStartDate = '';
                if (typeof t.planEndDate !== 'string') t.planEndDate = '';
                if (typeof t.sourceType !== 'string') t.sourceType = '';
                if (typeof t.sourceRecordId !== 'string') t.sourceRecordId = '';
                if (typeof t.sourceMatchKey !== 'string' || !t.sourceMatchKey) {
                    t.sourceMatchKey = normalizeTodoTextKeyLocal(t.text || '');
                }
                t.sessions.forEach(session => {
                    if (!session.id) session.id = genId();
                    if (typeof session.date !== 'string') session.date = '';
                    if (typeof session.startTime !== 'string') session.startTime = '';
                    if (typeof session.endTime !== 'string') session.endTime = '';
                    if (typeof session.note !== 'string') session.note = '';
                });
            });
            const seenHabitIds = new Set();
            target.habits.forEach(habit => {
                // 云同步或导入异常时，重复习惯 ID 会直接导致两条习惯共用同一份打卡记录。
                if (!habit.id || seenHabitIds.has(habit.id)) habit.id = genId();
                seenHabitIds.add(habit.id);
                if (!['ask', 'always', 'never'].includes(habit.noteMode)) habit.noteMode = 'ask';
                habit.rewardPoints = Math.max(0, parseInt(habit.rewardPoints ?? 0, 10) || 0);
                habit.rewardCurrency = normalizeHabitCurrency(habit.rewardCurrency);
                habit.penaltyPoints = Math.max(0, parseInt(habit.penaltyPoints ?? 0, 10) || 0);
                habit.penaltyCurrency = normalizeHabitCurrency(habit.penaltyCurrency || habit.rewardCurrency);
                habit.randomReward = !!habit.randomReward;
                habit.rewardMin = Math.max(0, parseInt(habit.rewardMin ?? habit.rewardPoints, 10) || 0);
                habit.rewardMax = Math.max(habit.rewardMin, parseInt(habit.rewardMax ?? habit.rewardPoints, 10) || habit.rewardMin);
                if (!['none', 'fixed', 'stage'].includes(habit.breakPenaltyMode)) habit.breakPenaltyMode = 'none';
                habit.breakPenaltyPoints = Math.max(0, parseInt(habit.breakPenaltyPoints ?? 0, 10) || 0);
                habit.breakPenaltyCurrency = normalizeHabitCurrency(habit.breakPenaltyCurrency || habit.penaltyCurrency);
                habit.milestoneRewards = normalizeHabitMilestoneRewards(habit.milestoneRewards);
            });
            target.records.forEach(r => {
                if (!Array.isArray(r.todoIds)) r.todoIds = [];
                if (typeof r.content !== 'string') r.content = '';
                r.ideaTags = normalizeTagList(r.ideaTags);
                if (r.type === '灵感碎片') {
                    if (!IDEA_STATUS_OPTIONS.includes(r.ideaStatus)) r.ideaStatus = '待整理';
                    if (typeof r.ideaNextAction !== 'string') r.ideaNextAction = '';
                    if (typeof r.ideaTodoId !== 'string') r.ideaTodoId = '';
                    if (typeof r.ideaConclusion !== 'string') r.ideaConclusion = '';
                }
                const template = r.templateId ? getBuiltInTemplate(r.templateId) : null;
                if ((!r.content || !r.content.trim()) && r.templateFields && template?.fields) {
                    r.content = composeTemplateContent(template, r.templateFields);
                }
                delete r.templateFields;
                if (r.isDraft) r.isDraft = false;
            });
            const validHabitIds = new Set(target.habits.map(habit => habit.id).filter(Boolean));
            target.checkins = target.checkins.filter(checkin => validHabitIds.has(checkin?.habitId));
            target.checkins.forEach(checkin => {
                if (!checkin.id) checkin.id = genId();
                if (typeof checkin.note !== 'string') checkin.note = '';
                if (!checkin.checkinAt && checkin.date) {
                    const clock = /^\d{2}:\d{2}$/.test(checkin.time || '') ? `${checkin.time}:00` : '00:00:00';
                    checkin.checkinAt = `${checkin.date}T${clock}`;
                }
                if (!checkin.createdAt) checkin.createdAt = checkin.checkinAt || getLocalDateTimeStr();
                if (!checkin.updatedAt) checkin.updatedAt = checkin.createdAt;
            });
            target.habitPointLedger.forEach(entry => {
                if (!entry.id) entry.id = genId();
                entry.amount = parseInt(entry.amount || 0, 10) || 0;
                if (typeof entry.type !== 'string') entry.type = 'adjust';
                if (typeof entry.note !== 'string') entry.note = '';
                if (typeof entry.date !== 'string') entry.date = getTodayStr();
                if (typeof entry.habitId !== 'string') entry.habitId = '';
                if (typeof entry.rewardId !== 'string') entry.rewardId = '';
                if (typeof entry.sourceId !== 'string') entry.sourceId = '';
                entry.currency = normalizeHabitCurrency(entry.currency);
                if (!entry.createdAt) entry.createdAt = getLocalDateTimeStr();
                if (!entry.updatedAt) entry.updatedAt = entry.createdAt;
            });
            target.habitRewards.forEach(reward => {
                if (!reward.id) reward.id = genId();
                if (typeof reward.name !== 'string') reward.name = '未命名心愿';
                reward.cost = Math.max(1, parseInt(reward.cost || 1, 10) || 1);
                reward.currency = normalizeHabitCurrency(reward.currency);
                reward.stock = Math.max(0, parseInt(reward.stock || 0, 10) || 0);
                reward.redeemedCount = Math.max(0, parseInt(reward.redeemedCount || 0, 10) || 0);
                if (typeof reward.note !== 'string') reward.note = '';
                if (!reward.createdAt) reward.createdAt = getLocalDateTimeStr();
                if (!reward.updatedAt) reward.updatedAt = reward.createdAt;
            });
            target.goals.forEach(g => {
                if (typeof g.progress !== 'number') g.progress = g.status === '已完成' ? 100 : 0;
            });
            target.materials.forEach(material => {
                if (!material.id) material.id = genId();
                if (!MATERIAL_TYPES.includes(material.type)) material.type = '摘抄';
                if (typeof material.content !== 'string') material.content = '';
                if (!Array.isArray(material.tags)) material.tags = normalizeTagList(material.tags);
                if (typeof material.source !== 'string') material.source = '';
                if (typeof material.note !== 'string') material.note = '';
                if (!material.createdAt) material.createdAt = getLocalDateTimeStr();
                if (!material.updatedAt) material.updatedAt = material.createdAt;
            });
            if (window.LifePlanFitnessService?.create) {
                const fitnessService = window.LifePlanFitnessService.create({
                    getTodayStr: () => getTodayStr(),
                    getNowLocal: () => getLocalDateTimeStr(),
                    genId: () => genId()
                });
                fitnessService.normalizeFitnessData(target);
            } else {
                target.bodyMetrics = Array.isArray(target.bodyMetrics) ? target.bodyMetrics : [];
                target.fitnessPlans = Array.isArray(target.fitnessPlans) ? target.fitnessPlans : [];
                target.fitnessWorkouts = Array.isArray(target.fitnessWorkouts) ? target.fitnessWorkouts : [];
                target.exerciseLibrary = Array.isArray(target.exerciseLibrary) ? target.exerciseLibrary : [];
            }
            target.wheelTags.forEach(tag => {
                if (!tag.id) tag.id = genId();
            });
            const wheelTagIdRemap = new Map();
            const seenWheelTagNames = new Map();
            target.wheelTags.forEach(tag => {
                const name = String(tag.name || '未命名标签').trim() || '未命名标签';
                const key = name.toLowerCase();
                if (seenWheelTagNames.has(key)) {
                    wheelTagIdRemap.set(tag.id, seenWheelTagNames.get(key));
                } else {
                    seenWheelTagNames.set(key, tag.id);
                    wheelTagIdRemap.set(tag.id, tag.id);
                }
            });
            target.wheelTags = target.wheelTags.filter(tag => wheelTagIdRemap.get(tag.id) === tag.id);
            const validWheelTagIds = () => new Set(target.wheelTags.map(tag => tag.id).filter(Boolean));
            const normalizeWheelTagIds = tagIds => {
                const valid = validWheelTagIds();
                const seen = new Set();
                return (Array.isArray(tagIds) ? tagIds : [])
                    .map(tagId => wheelTagIdRemap.get(tagId) || tagId)
                    .filter(tagId => typeof tagId === 'string' && tagId && valid.has(tagId))
                    .filter(tagId => {
                        if (seen.has(tagId)) return false;
                        seen.add(tagId);
                        return true;
                    });
            };
            target.wheels.forEach(wheel => {
                if (!wheel.id) wheel.id = genId();
                if (!wheel.name) wheel.name = '未命名转盘';
                if (wheel.mode !== 'tag') wheel.mode = 'normal';
                if (!Array.isArray(wheel.items)) wheel.items = [];
                if (wheel.mode === 'tag') {
                    if (!Array.isArray(wheel.tagIds)) wheel.tagIds = [];
                    wheel.tagIds = normalizeWheelTagIds(wheel.tagIds);
                } else {
                    delete wheel.tagIds;
                }
                wheel.items.forEach(item => {
                    if (!item.id) item.id = genId();
                    if (!item.name) item.name = '未命名选项';
                    item.weight = Math.max(1, Number(item.weight) || 1);
                    if (typeof item.note !== 'string') item.note = '';
                    if (item.enabled === undefined) item.enabled = true;
                    if (typeof item.sourceLibraryItemId !== 'string') delete item.sourceLibraryItemId;
                    if (!item.createdAt) item.createdAt = getLocalDateTimeStr();
                    if (!item.updatedAt) item.updatedAt = item.createdAt;
                });
                if (wheel.mode === 'tag') {
                    wheel.items = [];
                } else {
                    const seenWheelItems = new Set();
                    wheel.items = wheel.items.filter(item => {
                        const key = String(item.name || '').trim().toLowerCase();
                        if (!key || seenWheelItems.has(key)) return false;
                        seenWheelItems.add(key);
                        return true;
                    });
                }
                if (!wheel.createdAt) wheel.createdAt = getLocalDateTimeStr();
                if (!wheel.updatedAt) wheel.updatedAt = wheel.createdAt;
            });
            target.wheelTags.forEach(tag => {
                if (!tag.id) tag.id = genId();
                if (!tag.name) tag.name = '未命名标签';
                tag.color = normalizeWheelColor(tag.color);
                tag.weight = Math.max(1, Number(tag.weight) || 1);
                if (tag.enabled === undefined) tag.enabled = true;
                if (!tag.createdAt) tag.createdAt = getLocalDateTimeStr();
                if (!tag.updatedAt) tag.updatedAt = tag.createdAt;
            });
            target.wheelLibraryItems.forEach(item => {
                if (!item.id) item.id = genId();
                if (!item.name) item.name = '未命名公共项';
                if (!Array.isArray(item.tagIds)) item.tagIds = [];
                item.tagIds = normalizeWheelTagIds(item.tagIds);
                item.weight = Math.max(1, Number(item.weight) || 1);
                if (typeof item.note !== 'string') item.note = '';
                if (item.enabled === undefined) item.enabled = true;
                if (!item.createdAt) item.createdAt = getLocalDateTimeStr();
                if (!item.updatedAt) item.updatedAt = item.createdAt;
            });
            const seenWheelLibraryItems = new Set();
            target.wheelLibraryItems = target.wheelLibraryItems.filter(item => {
                const key = String(item.name || '').trim().toLowerCase();
                if (!key || seenWheelLibraryItems.has(key)) return false;
                seenWheelLibraryItems.add(key);
                return true;
            });
            target.wheelHistory.forEach(history => {
                if (!history.id) history.id = genId();
                if (typeof history.wheelId !== 'string') history.wheelId = '';
                if (typeof history.wheelName !== 'string') history.wheelName = '未命名转盘';
                if (history.mode !== 'tag') history.mode = 'normal';
                if (typeof history.tagId !== 'string') delete history.tagId;
                if (typeof history.tagName !== 'string') delete history.tagName;
                if (typeof history.resultId !== 'string') delete history.resultId;
                if (typeof history.resultName !== 'string') history.resultName = '未命名结果';
                if (typeof history.note !== 'string') history.note = '';
                if (!history.createdAt) history.createdAt = getLocalDateTimeStr();
                if (!history.updatedAt) history.updatedAt = history.createdAt;
                if (typeof history.convertedTodoId !== 'string') history.convertedTodoId = '';
            });
            return target;
        }

        function hashString(str) {
            return syncService.hashString(str);
        }

        function getDataHash(value = data) {
            return syncService.getDataHash(value);
        }

        function getWheelSnapshot(source = data) {
            return syncService.getWheelSnapshot(source);
        }

        function getWheelDataHash(value = getWheelSnapshot()) {
            return syncService.getWheelDataHash(value);
        }

        function getHabitAppSnapshot(source = habitAppLocalMirror) {
            return syncService.getHabitSnapshot(source || {});
        }

        function getHabitAppDataHash(value = getHabitAppSnapshot()) {
            return syncService.getHabitDataHash(value);
        }

        function mergeHabitAppSnapshots(localSnapshot, remoteSnapshot) {
            return syncService.mergeHabitSnapshots(localSnapshot, remoteSnapshot);
        }

        function applyWheelSnapshot(snapshot, shouldRender = true) {
            const next = snapshot && typeof snapshot === 'object' ? snapshot : {};
            const previousData = cloneDataSnapshot(data);
            data.wheels = Array.isArray(next.wheels) ? next.wheels : [];
            data.wheelTags = Array.isArray(next.wheelTags) ? next.wheelTags : [];
            data.wheelLibraryItems = Array.isArray(next.wheelLibraryItems) ? next.wheelLibraryItems : [];
            data.wheelHistory = Array.isArray(next.wheelHistory) ? next.wheelHistory : [];
            const nextWheelDeletedItems = Array.isArray(next.deletedItems) ? next.deletedItems.filter(item => isWheelDeletionCollection(item?.collection)) : [];
            const preservedDeletedItems = Array.isArray(data.deletedItems) ? data.deletedItems.filter(item => !isWheelDeletionCollection(item?.collection)) : [];
            data.deletedItems = [...preservedDeletedItems, ...nextWheelDeletedItems];
            normalizeDataShape();
            if (!saveDataFromWheelSync()) {
                data = previousData;
                throw new Error('大转盘同步数据未能写入本地存储');
            }
            if (shouldRender) renderAfterDataChange();
        }

        function isWheelDeletionCollection(collection = '') {
            return syncService.isWheelDeletionCollection(collection);
        }

        function mergeWheelSnapshots(localSnapshot, remoteSnapshot) {
            return syncService.mergeWheelSnapshots(localSnapshot, remoteSnapshot);
        }

        // 保存数据
        function saveData() {
            normalizeDataShape();
            if (!persistLocalValue('lifePlanData', JSON.stringify(data), '主数据')) return false;
            hasUnreliableLocalSave = false;
            localSaveWarning = '';
            renderLocalSaveWarning();
            if (!suppressDirtyMark) {
                syncState.dirty = true;
                syncState.lastLocalHash = getDataHash();
                saveSyncState();
                scheduleAutoCloudSync('本地修改，稍后自动同步');
                const currentWheelHash = getWheelDataHash();
                if (currentWheelHash !== wheelSyncState.lastLocalHash) {
                    wheelSyncState.dirty = true;
                    wheelSyncState.lastLocalHash = currentWheelHash;
                    saveWheelSyncState();
                    scheduleAutoWheelCloudSync('大转盘数据已修改，稍后自动同步');
                }
            }
            return true;
        }

        function loadSyncState() {
            try {
                const saved = localStorage.getItem('lifePlanSyncState');
                if (saved) syncState = { ...syncState, ...JSON.parse(saved) };
            } catch (err) {
                console.warn('同步状态读取失败', err);
            }
            syncState.lastLocalHash = syncState.lastLocalHash || getDataHash();
        }

        function saveSyncState() {
            syncState.lastLocalHash = getDataHash();
            persistLocalValue('lifePlanSyncState', JSON.stringify(syncState), '同步状态');
        }

        function loadWheelSyncState() {
            try {
                const saved = localStorage.getItem('lifePlanWheelSyncState');
                if (saved) wheelSyncState = { ...wheelSyncState, ...JSON.parse(saved) };
            } catch (err) {
                console.warn('大转盘同步状态读取失败', err);
            }
            wheelSyncState.lastLocalHash = wheelSyncState.lastLocalHash || getWheelDataHash();
        }

        function saveWheelSyncState() {
            wheelSyncState.lastLocalHash = getWheelDataHash();
            persistLocalValue('lifePlanWheelSyncState', JSON.stringify(wheelSyncState), '大转盘同步状态');
        }

        function saveDataFromSync() {
            suppressDirtyMark = true;
            try {
                return saveData();
            } finally {
                suppressDirtyMark = false;
            }
        }

        function saveDataFromWheelSync() {
            suppressDirtyMark = true;
            try {
                return saveData();
            } finally {
                suppressDirtyMark = false;
            }
        }

        const MAX_LOCAL_SNAPSHOTS = 20;

        function cloneDataSnapshot(value = data) {
            return snapshotService.cloneDataSnapshot(value);
        }

        function getTimestampForFile(date = new Date()) {
            return snapshotService.getTimestampForFile(date);
        }

        function getLocalSnapshots() {
            return snapshotService.getAll();
        }

        function normalizeLocalSnapshots(snapshots = []) {
            return snapshotService.normalize(snapshots);
        }

        function saveLocalSnapshots(snapshots) {
            try {
                return snapshotService.saveAll(snapshots);
            } catch (err) {
                recordCriticalFailure('本地快照列表写入失败', err, { action: 'snapshot-save-all' });
                updateSyncStatus('本地快照列表写入失败，请先导出备份或清理浏览器存储。', true);
                return null;
            }
        }

        function getNextSnapshotVersion(snapshots = getLocalSnapshots()) {
            return snapshotService.getNextVersion(snapshots);
        }

        function getSnapshotParent(snapshots = getLocalSnapshots(), meta = {}) {
            return snapshotService.getParent(snapshots, meta);
        }

        function createLocalSnapshot(reason = '自动快照', sourceData = data, meta = {}) {
            let snapshot = null;
            try {
                snapshot = snapshotService.createSnapshot(reason, sourceData, meta);
            } catch (err) {
                console.warn('本地快照写入失败', err);
                recordCriticalFailure('本地快照写入失败', err, { action: meta.action || 'snapshot-create' });
                updateSyncStatus('本地快照写入失败，可能是浏览器存储空间不足', true);
                return null;
            }

            if (!snapshot) {
                recordCriticalFailure('本地快照写入失败', null, { action: meta.action || 'snapshot-create', message: '快照服务返回空结果' });
                updateSyncStatus('本地快照写入失败，当前数据未受影响。请导出备份或清理旧快照后重试。', true);
                return null;
            }

            renderSnapshotList();
            updateSyncStatus(`已创建本地快照：${reason}`);
            return snapshot;
        }

        function formatBytes(bytes = 0) {
            return snapshotService.formatBytes(bytes);
        }

        function downloadJsonFile(filename, payload) {
            snapshotService.downloadJsonFile(filename, payload);
        }

        function getSnapshotStorageStats(snapshots = getLocalSnapshots()) {
            return snapshotService.getStorageStats(snapshots);
        }

        function renderSnapshotStorageNotice(snapshots = getLocalSnapshots()) {
            const container = document.getElementById('snapshot-storage-notice');
            if (!container) return;
            const stats = getSnapshotStorageStats(snapshots);
            container.className = `snapshot-storage-notice ${stats.isRisky ? 'is-warning' : ''}`;
            container.innerHTML = `
                <strong>快照占用 ${formatBytes(stats.totalBytes)}</strong>
                <span>已保留 ${stats.count}/${MAX_LOCAL_SNAPSHOTS} 份，最近一份 ${formatBytes(stats.latestBytes)}。${stats.isRisky ? '数据变大时建议先导出备份，避免浏览器本地存储写满。' : '数据继续变大后，可定期手动导出一份离线备份。'}</span>
            `;
        }

        function openSnapshotModal() {
            const snapshots = getLocalSnapshots();
            renderCriticalFailureLog();
            renderSnapshotStorageNotice(snapshots);
            renderSnapshotList(snapshots);
            document.getElementById('snapshot-modal').classList.add('active');
        }

        function closeSnapshotModal() {
            document.getElementById('snapshot-modal').classList.remove('active');
        }

        function getSnapshotSummary(snapshot) {
            const snapshotData = snapshot?.data || {};
            const collections = {
                records: snapshotData.records || [],
                todos: snapshotData.todos || [],
                habits: snapshotData.habits || [],
                checkins: snapshotData.checkins || [],
                habitPointLedger: snapshotData.habitPointLedger || [],
                habitRewards: snapshotData.habitRewards || [],
                habitCurrencies: snapshotData.habitCurrencies || [],
                goals: snapshotData.goals || [],
                materials: snapshotData.materials || [],
                bodyMetrics: snapshotData.bodyMetrics || [],
                fitnessPlans: snapshotData.fitnessPlans || [],
                fitnessWorkouts: snapshotData.fitnessWorkouts || [],
                exerciseLibrary: snapshotData.exerciseLibrary || []
            };
            const latestRecords = [...collections.records]
                .filter(record => !record.isHabitRecord)
                .sort((a, b) => (b.updatedAt || b.createdAt || b.startDate || '').localeCompare(a.updatedAt || a.createdAt || a.startDate || ''))
                .slice(0, 3);
            const openTodos = collections.todos.filter(todo => !todo.done).length;
            const doneTodos = collections.todos.filter(todo => todo.done).length;
            return { collections, latestRecords, openTodos, doneTodos };
        }

        function getSnapshotRelationText(snapshot) {
            const parts = [];
            if (snapshot.parent) {
                const parentVersion = snapshot.parent.version ? `v${snapshot.parent.version}` : '上一版';
                const parentHash = snapshot.parent.hash ? ` · ${String(snapshot.parent.hash).slice(0, 8)}` : '';
                parts.push(`上一个版本：${parentVersion}${parentHash}`);
            } else {
                parts.push('上一个版本：无');
            }
            if (snapshot.mergedWith) {
                const label = snapshot.mergedWith.label || '未知来源';
                const hash = snapshot.mergedWith.hash ? ` · ${String(snapshot.mergedWith.hash).slice(0, 8)}` : '';
                const version = snapshot.mergedWith.version ? ` · v${snapshot.mergedWith.version}` : '';
                parts.push(`合并对象：${label}${version}${hash}`);
            }
            if (snapshot.source) parts.push(`来源：${snapshot.source}${snapshot.action ? `/${snapshot.action}` : ''}`);
            return parts.join(' ｜ ');
        }

        function renderSnapshotPreview(snapshotId) {
            const container = document.getElementById('snapshot-preview');
            if (!container) return;
            const snapshot = getLocalSnapshots().find(item => item.id === snapshotId);
            if (!snapshot) {
                container.innerHTML = '';
                return;
            }
            const { collections, latestRecords, openTodos, doneTodos } = getSnapshotSummary(snapshot);
            container.innerHTML = `
                <div class="snapshot-preview-card">
                    <div class="snapshot-preview-head">
                        <div>
                            <div class="snapshot-version">v${snapshot.version || '?'} · ${escapeHtml(snapshot.reason || '本地快照')}</div>
                            <div class="snapshot-meta">${formatStoredDateTime(snapshot.createdAt)} · ${formatBytes(snapshot.bytes || 0)} · ${escapeHtml(snapshot.hash || '')}</div>
                        </div>
                        <button class="btn btn-secondary todo-mini-btn" onclick="document.getElementById('snapshot-preview').innerHTML=''">收起</button>
                    </div>
                    <div class="snapshot-relation">${escapeHtml(getSnapshotRelationText(snapshot))}</div>
                    <div class="snapshot-preview-stats">
                        <span>记录 ${collections.records.length}</span>
                        <span>待办 ${collections.todos.length}（未完成 ${openTodos} / 已完成 ${doneTodos}）</span>
                        <span>习惯 ${collections.habits.length}</span>
                        <span>打卡 ${collections.checkins.length}</span>
                        <span>目标 ${collections.goals.length}</span>
                        <span>素材 ${collections.materials.length}</span>
                        <span>身材 ${collections.bodyMetrics.length}</span>
                        <span>训练计划 ${collections.fitnessPlans.length}</span>
                        <span>训练日志 ${collections.fitnessWorkouts.length}</span>
                        <span>动作库 ${collections.exerciseLibrary.length}</span>
                    </div>
                    <div class="snapshot-preview-list">
                        <strong>最近记录</strong>
                        ${latestRecords.length
                            ? latestRecords.map(record => `<div>${escapeHtml(record.startDate || '')} · ${escapeHtml(record.type || '记录')} · ${escapeHtml(record.title || '无标题')}</div>`).join('')
                            : '<div>暂无记录</div>'}
                    </div>
                </div>
            `;
        }

        function renderSnapshotList(snapshotSource = null) {
            const container = document.getElementById('snapshot-list');
            if (!container) return;
            const snapshots = snapshotSource || getLocalSnapshots();
            renderSnapshotStorageNotice(snapshots);
            if (snapshots.length === 0) {
                const preview = document.getElementById('snapshot-preview');
                if (preview) preview.innerHTML = '';
                container.innerHTML = '<div class="snapshot-empty">还没有本地快照。同步、导入、删除前会自动创建，也可以手动创建一份。</div>';
                return;
            }

            container.innerHTML = snapshots.map(snapshot => `
                <div class="snapshot-item">
                    <div class="snapshot-main">
                        <div class="snapshot-title"><span class="snapshot-version-pill">v${snapshot.version || '?'}</span>${escapeHtml(snapshot.reason || '本地快照')}</div>
                        <div class="snapshot-meta">
                            ${formatStoredDateTime(snapshot.createdAt)} · ${formatBytes(snapshot.bytes || 0)} · ${escapeHtml(snapshot.hash || '')}
                        </div>
                        <div class="snapshot-relation">${escapeHtml(getSnapshotRelationText(snapshot))}</div>
                    </div>
                    <div class="snapshot-actions">
                        <button class="btn btn-secondary" onclick="renderSnapshotPreview(${escapeJsArg(snapshot.id)})">预览</button>
                        <button class="btn btn-secondary" onclick="restoreLocalSnapshot(${escapeJsArg(snapshot.id)})">恢复</button>
                        <button class="btn btn-secondary" onclick="downloadLocalSnapshot(${escapeJsArg(snapshot.id)})">下载</button>
                        <button class="btn btn-danger" onclick="deleteLocalSnapshot(${escapeJsArg(snapshot.id)})">删除</button>
                    </div>
                </div>
            `).join('');
        }

        function downloadLocalSnapshot(snapshotId) {
            const snapshot = getLocalSnapshots().find(item => item.id === snapshotId);
            if (!snapshot) return;
            downloadJsonFile(`人生规划快照_${getTimestampForFile(new Date(snapshot.createdAt || Date.now()))}.json`, snapshot.data);
        }

        function restoreLocalSnapshot(snapshotId) {
            const snapshot = getLocalSnapshots().find(item => item.id === snapshotId);
            if (!snapshot) return;
            if (!confirm(`确定恢复到「${snapshot.reason || '本地快照'}」吗？当前数据会先自动保存一份恢复前快照。`)) return;
            const beforeSnapshot = createLocalSnapshot('恢复前自动快照', data, {
                source: 'restore',
                action: 'before-restore',
                mergedWith: { label: `恢复目标 v${snapshot.version || '?'}`, hash: snapshot.hash || '' }
            });
            if (!beforeSnapshot && !confirm('恢复前快照创建失败。继续恢复会缺少回滚点，确定继续吗？')) return;
            const previousData = data;
            data = cloneDataSnapshot(snapshot.data);
            if (!saveData()) {
                data = previousData;
                recordCriticalFailure('恢复本地快照失败', null, { action: 'restore-snapshot', message: '恢复后的数据未能写入本地存储' });
                alert('恢复失败：本地存储写入失败，当前数据已保持不变。请先导出备份或清理存储空间。');
                return;
            }
            renderAfterDataChange();
            closeSnapshotModal();
            updateSyncStatus(`已恢复本地快照：${formatStoredDateTime(snapshot.createdAt)}`);
        }

        function deleteLocalSnapshot(snapshotId) {
            if (!confirm('确定删除这份本地快照吗？')) return;
            if (!saveLocalSnapshots(getLocalSnapshots().filter(item => item.id !== snapshotId))) return;
            renderSnapshotList();
        }

        function renderAfterDataChange() {
            renderDashboard();
            renderAllRecords();
            renderTodoTable();
            renderHabitPage();
            renderHabitCurrencyOptions();
            renderGoalList();
            renderWheelPage();
            if (typeof renderFitnessPage === 'function') renderFitnessPage();
            refreshKnowledgeViews();
        }

        function loadSyncConfig() {
            try {
                const saved = localStorage.getItem('lifePlanSyncConfig');
                if (saved) syncConfig = { ...syncConfig, ...JSON.parse(saved) };
            } catch (err) {
                console.warn('同步配置读取失败', err);
            }
            syncConfig.webdavUrl = syncConfig.webdavUrl || '';
            delete syncConfig.username;
            delete syncConfig.password;
            syncConfig.remotePath = syncConfig.remotePath || '/life-plan.json';
            syncConfig.autoSync = syncConfig.autoSync !== false;
            applySyncSettingsToForm();
            updateSyncStatus(syncConfig.webdavUrl ? '已加载云同步配置' : '未配置云同步');
        }

        function loadWheelSyncConfig() {
            try {
                const saved = localStorage.getItem('lifePlanWheelSyncConfig');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (!syncConfig.webdavUrl && parsed.webdavUrl) syncConfig.webdavUrl = parsed.webdavUrl;
                    wheelSyncConfig = { ...wheelSyncConfig, ...parsed };
                    delete wheelSyncConfig.webdavUrl;
                }
            } catch (err) {
                console.warn('大转盘同步配置读取失败', err);
            }
            wheelSyncConfig.remotePath = wheelSyncConfig.remotePath || '/apps/wheel-app/data.json';
            wheelSyncConfig.autoSync = wheelSyncConfig.autoSync !== false;
            saveSyncConfigToLocal();
            applyWheelSyncSettingsToForm();
            updateWheelSyncStatus(syncConfig.webdavUrl ? '已加载大转盘同步配置' : '未配置大转盘同步');
        }

        function saveSyncConfigToLocal() {
            delete syncConfig.username;
            delete syncConfig.password;
            persistLocalValue('lifePlanSyncConfig', JSON.stringify(syncConfig), '同步配置');
            applySyncSettingsToForm();
        }

        function saveWheelSyncConfigToLocal() {
            persistLocalValue('lifePlanWheelSyncConfig', JSON.stringify(wheelSyncConfig), '大转盘同步配置');
            applyWheelSyncSettingsToForm();
        }

        function loadHabitSyncConfig() {
            try {
                const saved = localStorage.getItem('habitAppSyncConfig');
                if (saved) {
                    habitSyncConfig = { ...habitSyncConfig, ...JSON.parse(saved) };
                }
            } catch (err) {
                console.warn('habit-app 同步配置读取失败', err);
            }
            habitSyncConfig.remotePath = habitSyncConfig.remotePath || '/apps/habit-app/data.json';
            habitSyncConfig.autoSync = false;
            habitSyncConfig.remoteUploadEnabled = false;
            saveHabitSyncConfigToLocal();
        }

        function saveHabitSyncConfigToLocal() {
            habitSyncConfig.remotePath = habitSyncConfig.remotePath || '/apps/habit-app/data.json';
            habitSyncConfig.autoSync = false;
            habitSyncConfig.remoteUploadEnabled = false;
            persistLocalValue('habitAppSyncConfig', JSON.stringify(habitSyncConfig), 'habit-app 同步配置');
        }

        function loadHabitSyncState() {
            try {
                const saved = localStorage.getItem('habitAppSyncState');
                if (saved) habitSyncState = { ...habitSyncState, ...JSON.parse(saved) };
            } catch (err) {
                console.warn('habit-app 同步状态读取失败', err);
            }
            habitSyncState.lastLocalHash = habitSyncState.lastLocalHash || getHabitLegacySourceHash();
            habitSyncState.lastRebuildAt = habitSyncState.lastRebuildAt || habitAppLocalMirrorMeta.lastRebuildAt || '';
            habitSyncState.lastRebuildReason = habitSyncState.lastRebuildReason || habitAppLocalMirrorMeta.lastRebuildReason || '';
        }

        function saveHabitSyncState() {
            habitSyncState.lastLocalHash = habitSyncState.lastLocalHash || getHabitLegacySourceHash();
            persistLocalValue('habitAppSyncState', JSON.stringify(habitSyncState), 'habit-app 同步状态');
        }

        function getHabitRemotePreviewBalances(snapshot = {}) {
            const balances = new Map();
            (snapshot.habitLedger || []).forEach(item => {
                const amount = Number(item?.amount);
                if (!Number.isFinite(amount)) return;
                const currency = String(item?.currency || item?.currencyId || HABIT_DEFAULT_CURRENCY).trim() || HABIT_DEFAULT_CURRENCY;
                balances.set(currency, (balances.get(currency) || 0) + amount);
            });
            return Array.from(balances.entries())
                .sort(([a], [b]) => a.localeCompare(b, 'zh-Hans-CN'))
                .map(([currency, amount]) => ({ currency, amount }));
        }

        function formatHabitRemotePreviewBalances(balances = []) {
            return balances.length
                ? balances.map(item => `${item.amount} ${item.currency}`).join(' · ')
                : `0 ${HABIT_DEFAULT_CURRENCY}`;
        }

        function getHabitRemotePreviewModel(source = {}, hash = '') {
            const snapshot = syncService.getHabitSnapshot(source);
            const balances = getHabitRemotePreviewBalances(snapshot);
            const resolvedHash = hash || syncService.getHabitDataHash(snapshot);
            return {
                snapshot,
                hash: resolvedHash,
                hashShort: resolvedHash ? resolvedHash.slice(0, 12) : '',
                counts: {
                    habits: snapshot.habits.length,
                    records: snapshot.habitRecords.length,
                    ledger: snapshot.habitLedger.length,
                    tombstones: snapshot.deletedItems.length
                },
                balances,
                balanceText: formatHabitRemotePreviewBalances(balances)
            };
        }

        function getHabitRemoteSchemaRisks(raw = {}) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
                return [{
                    severity: 'danger',
                    title: '云端 schema 不是对象',
                    detail: '远端文件必须是 habit-app JSON 对象；当前响应无法安全参与合并预览。'
                }];
            }
            const risks = [];
            const missing = HABIT_REMOTE_PREVIEW_COLLECTIONS.filter(key => !(key in raw));
            const invalid = HABIT_REMOTE_PREVIEW_COLLECTIONS.filter(key => key in raw && !Array.isArray(raw[key]));
            if (!Number.isFinite(Number(raw.schemaVersion))) {
                risks.push({
                    severity: 'warning',
                    title: '云端 schemaVersion 缺失或无效',
                    detail: '预检会按 schemaVersion 1 规范化，但不会保存规范化结果。'
                });
            }
            if (missing.length) {
                const criticalMissing = missing.some(key => ['habits', 'habitRecords', 'habitLedger'].includes(key));
                risks.push({
                    severity: criticalMissing ? 'danger' : 'warning',
                    title: '云端 schema 缺字段',
                    detail: `缺少数组字段：${missing.join('、')}。缺失字段仅在预览中按空数组处理。`
                });
            }
            if (invalid.length) {
                risks.push({
                    severity: 'danger',
                    title: '云端 schema 字段类型异常',
                    detail: `以下字段不是数组：${invalid.join('、')}。异常字段仅在预览中按空数组处理。`
                });
            }
            return risks;
        }

        function getHabitRemoteMergeRisks(local, remote, merged, schemaRisks = []) {
            const risks = [...schemaRisks];
            const countLabels = {
                habits: 'habits',
                records: 'habitRecords',
                ledger: 'habitLedger'
            };
            Object.entries(countLabels).forEach(([key, label]) => {
                const expectedFloor = Math.max(local.counts[key], remote.counts[key]);
                if (merged.counts[key] < expectedFloor) {
                    risks.push({
                        severity: 'warning',
                        title: `合并后 ${label} 数量减少`,
                        detail: `本地 ${local.counts[key]} · 云端 ${remote.counts[key]} · 合并 ${merged.counts[key]}。请检查 tombstone 或实体时间戳。`
                    });
                }
            });
            if (local.counts.tombstones !== remote.counts.tombstones || merged.counts.tombstones !== local.counts.tombstones) {
                risks.push({
                    severity: 'info',
                    title: 'tombstone 数量发生变化',
                    detail: `本地 ${local.counts.tombstones} · 云端 ${remote.counts.tombstones} · 合并 ${merged.counts.tombstones}。删除标记会保留在预览结果中。`
                });
            }
            const localBalances = JSON.stringify(local.balances);
            const remoteBalances = JSON.stringify(remote.balances);
            const mergedBalances = JSON.stringify(merged.balances);
            if (mergedBalances !== localBalances || mergedBalances !== remoteBalances) {
                risks.push({
                    severity: 'warning',
                    title: '合并后钱包余额变化',
                    detail: `本地 ${local.balanceText}；云端 ${remote.balanceText}；合并 ${merged.balanceText}。上传前需确认流水没有重复。`
                });
            }
            return risks;
        }

        function getHabitSyncScaffoldSummary() {
            const mirrorHash = habitAppLocalMirror ? getHabitAppDataHash(habitAppLocalMirror) : '';
            return {
                remotePath: habitSyncConfig.remotePath || '/apps/habit-app/data.json',
                endpointConfigured: !!syncConfig.webdavUrl,
                autoSync: !!habitSyncConfig.autoSync,
                remoteUploadEnabled: !!habitSyncConfig.remoteUploadEnabled,
                manualPullEnabled: !!(syncConfig.webdavUrl && habitSyncConfig.remotePath),
                manualPushEnabled: !!(syncConfig.webdavUrl && habitSyncConfig.remoteUploadEnabled && habitAppLocalMirror),
                dirty: !!habitSyncState.dirty,
                lastLocalHash: habitSyncState.lastLocalHash || '',
                lastLocalHashShort: (habitSyncState.lastLocalHash || '').slice(0, 12),
                mirrorHash,
                mirrorHashShort: mirrorHash ? mirrorHash.slice(0, 12) : '',
                lastRemoteHash: habitSyncState.lastRemoteHash || '',
                lastRemoteHashShort: (habitSyncState.lastRemoteHash || '').slice(0, 12),
                lastSyncAt: habitSyncState.lastSyncAt || '',
                lastPullAt: habitSyncState.lastPullAt || '',
                lastPushAt: habitSyncState.lastPushAt || '',
                lastRebuildAt: habitSyncState.lastRebuildAt || '',
                lastRebuildReason: habitSyncState.lastRebuildReason || '',
                mergeReady: typeof syncService.mergeHabitSnapshots === 'function',
                hashReady: typeof syncService.getHabitDataHash === 'function',
                phase: 'phase-5-readonly-remote-preview',
                statusLabel: habitSyncConfig.remoteUploadEnabled
                    ? '远端上传可手动触发'
                    : '远端上传关闭，仅只读预检'
            };
        }

        async function previewHabitRemotePull(mode = 'pull') {
            const previewMode = mode === 'merge' || mode === 'both' ? 'merge' : 'pull';
            if (isHabitRemotePreviewRunning) return false;
            ensureHabitAppLocalMirrorForDiagnostics();
            const scaffold = getHabitSyncScaffoldSummary();
            if (!scaffold.endpointConfigured) {
                habitRemotePreviewState = {
                    ...habitRemotePreviewState,
                    status: 'error',
                    mode: previewMode,
                    requestedAt: getLocalDateTimeStr(),
                    remotePath: scaffold.remotePath,
                    error: '请先在统一同步设置里填写 Cloudflare Worker / WebDAV 中转地址。',
                    local: habitAppLocalMirror ? getHabitRemotePreviewModel(habitAppLocalMirror) : null,
                    remote: null,
                    merged: null,
                    risks: []
                };
                renderHabitDiagnosticsPanel();
                return false;
            }
            isHabitRemotePreviewRunning = true;
            habitRemotePreviewState = {
                status: 'loading',
                mode: previewMode,
                requestedAt: getLocalDateTimeStr(),
                remotePath: scaffold.remotePath,
                error: '',
                local: habitAppLocalMirror ? getHabitRemotePreviewModel(habitAppLocalMirror) : null,
                remote: null,
                merged: null,
                risks: []
            };
            renderHabitDiagnosticsPanel();
            try {
                const remoteResult = await syncService.pullJson(
                    { ...syncConfig, remotePath: scaffold.remotePath },
                    scaffold.remotePath,
                    value => value,
                    value => syncService.getHabitDataHash(value)
                );
                const local = getHabitRemotePreviewModel(habitAppLocalMirror || {});
                if (!remoteResult) {
                    habitRemotePreviewState = {
                        ...habitRemotePreviewState,
                        status: 'missing',
                        local,
                        remote: null,
                        merged: null,
                        error: '',
                        risks: []
                    };
                    return false;
                }
                const schemaRisks = getHabitRemoteSchemaRisks(remoteResult.data);
                const remoteSnapshot = syncService.getHabitSnapshot(remoteResult.data);
                const mergedSnapshot = syncService.mergeHabitSnapshots(local.snapshot, remoteSnapshot);
                const remote = getHabitRemotePreviewModel(remoteSnapshot, remoteResult.hash);
                const merged = getHabitRemotePreviewModel(mergedSnapshot);
                habitRemotePreviewState = {
                    ...habitRemotePreviewState,
                    status: 'ready',
                    local,
                    remote: { ...remote, etag: remoteResult.etag || '' },
                    merged,
                    hashesMatch: local.hash === remote.hash,
                    error: '',
                    risks: getHabitRemoteMergeRisks(local, remote, merged, schemaRisks)
                };
                return true;
            } catch (err) {
                const isJsonError = err instanceof SyntaxError || /JSON/i.test(err?.message || '');
                habitRemotePreviewState = {
                    ...habitRemotePreviewState,
                    status: 'error',
                    error: isJsonError
                        ? `云端 JSON 解析失败：${err?.message || String(err)}`
                        : `只读检查失败：${err?.message || String(err)}`,
                    remote: null,
                    merged: null,
                    risks: []
                };
                return false;
            } finally {
                isHabitRemotePreviewRunning = false;
                renderHabitDiagnosticsPanel();
            }
        }

        async function runHabitManualSyncSkeleton(direction = 'pull') {
            if (direction === 'push') {
                alert('habit 远端上传仍是关闭状态。当前只允许 GET 只读预检，不会 PUT /apps/habit-app/data.json。');
                return false;
            }
            return previewHabitRemotePull(direction === 'both' ? 'merge' : 'pull');
        }

        function applySyncSettingsToForm() {
            const ids = ['sync-webdav-url', 'sync-remote-path', 'sync-auto'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                if (el.type === 'checkbox') el.checked = !!syncConfig.autoSync;
                else if (id === 'sync-webdav-url') el.value = syncConfig.webdavUrl || '';
                else if (id === 'sync-remote-path') el.value = syncConfig.remotePath || '';
            });
        }

        function applyWheelSyncSettingsToForm() {
            const pathEl = document.getElementById('wheel-sync-remote-path');
            const autoEl = document.getElementById('wheel-sync-auto');
            if (pathEl) pathEl.value = wheelSyncConfig.remotePath || '';
            if (autoEl) autoEl.checked = !!wheelSyncConfig.autoSync;
        }

        function updateSyncStatus(message, isError = false) {
            const text = message || '';
            const sideEl = document.getElementById('sync-status');
            const modalEl = document.getElementById('sync-modal-status');
            const inlineEl = document.getElementById('sync-status-inline');
            [sideEl, modalEl].forEach(el => {
                if (!el) return;
                el.textContent = text;
                el.classList.toggle('is-error', !!isError);
            });
            if (inlineEl) {
                inlineEl.textContent = getSyncStatusSummary(text, isError);
                inlineEl.classList.toggle('is-error', !!isError);
            }
        }

        function getSyncStatusSummary(message = '', isError = false) {
            const text = String(message || '').trim();
            if (isError) return '同步：失败';
            if (!text) return syncConfig.webdavUrl ? '同步：待检查' : '同步：未配置';
            if (text.includes('未配置')) return '同步：未配置';
            if (text.includes('正在') || text.includes('稍后')) return '同步：进行中';
            if (text.includes('完成') || text.includes('已上传') || text.includes('已拉取') || text.includes('一致') || text.includes('已同步')) return '同步：已同步';
            if (text.includes('已加载')) return '同步：已配置';
            return `同步：${text.replace(/\s+/g, ' ').slice(0, 16)}`;
        }

        function updateWheelSyncStatus(message, isError = false) {
            const text = message || '';
            const modalEl = document.getElementById('wheel-sync-modal-status');
            const inlineEl = document.getElementById('wheel-sync-status-inline');
            [modalEl].forEach(el => {
                if (!el) return;
                el.textContent = text;
                el.classList.toggle('is-error', !!isError);
            });
            if (inlineEl) {
                inlineEl.textContent = getWheelSyncStatusSummary(text, isError);
                inlineEl.classList.toggle('is-error', !!isError);
            }
        }

        function getWheelSyncStatusSummary(message = '', isError = false) {
            const text = String(message || '').trim();
            if (isError) return '转盘：失败';
            if (!text) return syncConfig.webdavUrl ? '转盘：待检查' : '转盘：未配置';
            if (text.includes('未配置')) return '转盘：未配置';
            if (text.includes('正在') || text.includes('稍后')) return '转盘：进行中';
            if (text.includes('完成') || text.includes('已上传') || text.includes('已拉取') || text.includes('一致') || text.includes('已同步')) return '转盘：已同步';
            if (text.includes('已加载')) return '转盘：已配置';
            return `转盘：${text.replace(/\s+/g, ' ').slice(0, 16)}`;
        }

        function openSyncSettings() {
            applySyncSettingsToForm();
            applyWheelSyncSettingsToForm();
            document.getElementById('sync-modal').classList.add('active');
        }

        function closeSyncSettings() {
            document.getElementById('sync-modal').classList.remove('active');
        }

        function readSyncForm() {
            syncConfig.webdavUrl = document.getElementById('sync-webdav-url').value.trim();
            syncConfig.remotePath = document.getElementById('sync-remote-path').value.trim() || '/life-plan.json';
            syncConfig.autoSync = document.getElementById('sync-auto').checked;
            saveSyncConfigToLocal();
        }

        function readWheelSyncForm() {
            readSyncForm();
            const pathInput = document.getElementById('wheel-sync-remote-path');
            const autoInput = document.getElementById('wheel-sync-auto');
            wheelSyncConfig.remotePath = pathInput?.value.trim() || '/apps/wheel-app/data.json';
            wheelSyncConfig.autoSync = !!autoInput?.checked;
            delete wheelSyncConfig.webdavUrl;
            saveWheelSyncConfigToLocal();
        }

        const AI_CONFIG_KEY = 'lifePlanAiConfig';

        function loadAiConfig() {
            try {
                const saved = localStorage.getItem(AI_CONFIG_KEY);
                if (saved) aiConfig = { ...aiConfig, ...JSON.parse(saved) };
            } catch (err) {
                console.warn('AI 配置读取失败', err);
            }
            aiConfig = aiService.normalizeConfig(aiConfig);
            applyAiSettingsToForm();
            updateAiSettingsStatus(aiConfig.remoteEnabled && aiConfig.endpointUrl ? '已加载 AI 接口配置' : '未启用远程 AI，将使用本地规则');
        }

        function saveAiConfigToLocal() {
            persistLocalValue(AI_CONFIG_KEY, JSON.stringify(aiConfig), 'AI 配置');
            applyAiSettingsToForm();
        }

        function updateAiKeyStorageStatus() {
            const statusEl = document.getElementById('ai-key-storage-status');
            if (!statusEl) return;
            const hasKey = !!String(aiConfig.apiKey || '').trim();
            statusEl.textContent = hasKey ? 'API Key 已保存在本浏览器本地' : '未保存 API Key';
            statusEl.classList.toggle('is-warning', hasKey);
        }

        function applyAiSettingsToForm() {
            const enabledEl = document.getElementById('ai-remote-enabled');
            const endpointEl = document.getElementById('ai-endpoint-url');
            const keyEl = document.getElementById('ai-api-key');
            const modelEl = document.getElementById('ai-model');
            const styleEl = document.getElementById('ai-user-style');
            if (enabledEl) enabledEl.checked = !!aiConfig.remoteEnabled;
            if (endpointEl) endpointEl.value = aiConfig.endpointUrl || '';
            if (keyEl) keyEl.value = aiConfig.apiKey || '';
            if (modelEl) modelEl.value = aiConfig.model || 'gpt-4.1-mini';
            if (styleEl) styleEl.value = aiConfig.userStyle || '';
            updateAiKeyStorageStatus();
        }

        function updateAiSettingsStatus(message, isError = false) {
            const settingsEl = document.getElementById('ai-settings-status');
            const assistantEl = document.getElementById('ai-assistant-status');
            [settingsEl, assistantEl].forEach(el => {
                if (!el) return;
                el.textContent = message || '';
                el.classList.toggle('is-error', !!isError);
            });
        }

        function updateAiRunButton() {
            const button = document.getElementById('ai-run-button');
            if (!button) return;
            const label = button.querySelector('.ai-run-label');
            button.disabled = isAiAssistantRunning;
            button.classList.toggle('is-loading', isAiAssistantRunning);
            button.setAttribute('aria-busy', isAiAssistantRunning ? 'true' : 'false');
            if (label) label.textContent = isAiAssistantRunning ? '生成中...' : '生成建议';
        }

        function setAiAssistantRunning(running) {
            isAiAssistantRunning = !!running;
            updateAiRunButton();
        }

        function getAiAssistantReadyMessage() {
            return isRemoteAiReady()
                ? '远程 AI 已配置，点击生成建议开始分析。'
                : '远程 AI 未配置或配置不完整，点击生成建议会使用本地规则。';
        }

        function openAiSettings() {
            applyAiSettingsToForm();
            updateAiSettingsStatus(aiConfig.remoteEnabled && aiConfig.endpointUrl ? '已加载 AI 接口配置' : '未启用远程 AI，将使用本地规则');
            document.getElementById('ai-settings-modal').classList.add('active');
        }

        function closeAiSettings() {
            document.getElementById('ai-settings-modal').classList.remove('active');
        }

        function readAiSettingsForm() {
            aiConfig.remoteEnabled = !!document.getElementById('ai-remote-enabled')?.checked;
            aiConfig.endpointUrl = document.getElementById('ai-endpoint-url')?.value.trim() || '';
            aiConfig.apiKey = document.getElementById('ai-api-key')?.value || '';
            aiConfig.model = document.getElementById('ai-model')?.value.trim() || 'gpt-4.1-mini';
            aiConfig.userStyle = document.getElementById('ai-user-style')?.value.trim() || '';
        }

        function saveAiSettings() {
            readAiSettingsForm();
            saveAiConfigToLocal();
            const keyNote = aiConfig.apiKey ? 'API Key 已保存在本浏览器本地，使用共用设备后请清除。' : '未保存 API Key。';
            updateAiSettingsStatus(aiConfig.remoteEnabled ? `AI 设置已保存。${keyNote}` : `AI 设置已保存。远程接口未启用，将使用本地规则。${keyNote}`);
        }

        function clearAiApiKey() {
            aiConfig.apiKey = '';
            const keyEl = document.getElementById('ai-api-key');
            if (keyEl) keyEl.value = '';
            saveAiConfigToLocal();
            updateAiSettingsStatus('API Key 已从本浏览器本地配置中清除。');
        }

        function isRemoteAiReady() {
            return aiService.isRemoteReady(aiConfig);
        }

        function getAiChatCompletionsUrl(endpointUrl = aiConfig.endpointUrl) {
            return aiService.getChatCompletionsUrl(endpointUrl);
        }

        async function testAiSettings() {
            readAiSettingsForm();
            saveAiConfigToLocal();
            if (!isRemoteAiReady()) {
                updateAiSettingsStatus('请先启用远程 AI，并填写接口地址、API Key 和模型。', true);
                return;
            }
            updateAiSettingsStatus('正在测试 AI 接口...');
            try {
                const result = await requestRemoteAi({
                    mode: 'settingsTest',
                    title: '测试接口',
                    instruction: '只返回 JSON：{"title":"AI 接口可用","summary":"一句中文确认","items":[]}',
                    context: { now: getLocalDateTimeStr() }
                });
                updateAiSettingsStatus(result?.summary || result?.title || 'AI 接口测试成功');
            } catch (err) {
                updateAiSettingsStatus(err.message || 'AI 接口测试失败', true);
            }
        }

        async function requestRemoteAi(payload) {
            return aiService.requestRemoteAi(aiConfig, payload);
        }

        function parseAiJson(content) {
            return aiService.parseAiJson(content);
        }

        function normalizeAiResult(result) {
            return aiService.normalizeAiResult(result);
        }

        // Shared AI bridge for page modules (e.g. wheel library tag suggestions).
        window.LifePlanAiBridge = {
            isRemoteReady: () => isRemoteAiReady(),
            requestRemote: payload => requestRemoteAi(payload),
            generateLocal: payload => generateLocalAiResult(payload),
            normalizeResult: result => normalizeAiResult(result)
        };

        const AI_MODE_META = {
            todayPlan: {
                title: 'AI 今日计划',
                subtitle: '根据今日待办、习惯、目标和近期记录，整理一个短行动清单。',
                inputLabel: '补充今天的状态或限制',
                placeholder: '例如：今天只有 2 小时深度工作，下午有会，优先推进项目交付。'
            },
            backlogTriage: {
                title: 'AI 待办整理',
                subtitle: '从未完成待办里挑出最值得今天推进的小步。',
                inputLabel: '整理偏好',
                placeholder: '例如：优先超期和高优先级；每条建议控制在 30 分钟内。'
            },
            todoBreakdown: {
                title: 'AI 拆解待办',
                subtitle: '选择一个待办，把它拆成可以勾选的子任务。',
                inputLabel: '拆解要求',
                placeholder: '例如：按准备、执行、收尾拆；每一步必须能直接开始。'
            },
            ideaNext: {
                title: 'AI 灵感下一步',
                subtitle: '选择一条灵感，把它变成一个小实验或下一步行动。',
                inputLabel: '转化要求',
                placeholder: '例如：先做最小验证，不要设计太大的项目。'
            },
            diaryReview: {
                title: 'AI 日记分析',
                subtitle: '从一篇日记里提炼复盘、明日重点和可确认的行动建议。',
                inputLabel: '分析偏好',
                placeholder: '例如：复盘要直白一点；明日重点只保留一件最关键的事。'
            },
            chatCapture: {
                title: 'AI 对话整理',
                subtitle: '把你随手说的一段话纠错、整理，并建议放到待办、工作、日记、计划或灵感。',
                inputLabel: '直接和 AI 说',
                placeholder: '例如：明天想把页面检查一下，顺手记个待办；今天工作里把 AI 对话整理跑通了，这个想法也可以先放灵感池。'
            }
        };

        function openAiAssistant(mode = 'todayPlan', sourceRecordId = '') {
            currentAiMode = AI_MODE_META[mode] ? mode : 'todayPlan';
            currentAiSourceRecordId = sourceRecordId || '';
            aiLastResult = null;
            document.getElementById('ai-assistant-modal').classList.add('active');
            renderAiAssistant();
        }

        function closeAiAssistant() {
            document.getElementById('ai-assistant-modal').classList.remove('active');
            aiLastResult = null;
            currentAiSourceRecordId = '';
            setAiAssistantRunning(false);
            const inputEl = document.getElementById('ai-user-input');
            if (inputEl) inputEl.value = '';
            const resultPanel = document.getElementById('ai-result-panel');
            if (resultPanel) resultPanel.innerHTML = '';
            const contextPanel = document.getElementById('ai-context-panel');
            if (contextPanel) contextPanel.innerHTML = '';
        }

        function setAiMode(mode) {
            if (!AI_MODE_META[mode]) return;
            currentAiMode = mode;
            if (mode !== 'diaryReview') currentAiSourceRecordId = '';
            aiLastResult = null;
            renderAiAssistant();
        }

        function renderAiAssistant() {
            const meta = AI_MODE_META[currentAiMode] || AI_MODE_META.todayPlan;
            const titleEl = document.getElementById('ai-assistant-title');
            const subtitleEl = document.getElementById('ai-assistant-subtitle');
            const labelEl = document.getElementById('ai-input-label');
            const inputEl = document.getElementById('ai-user-input');
            if (titleEl) titleEl.textContent = meta.title;
            if (subtitleEl) subtitleEl.textContent = meta.subtitle;
            if (labelEl) labelEl.textContent = meta.inputLabel;
            if (inputEl) inputEl.placeholder = meta.placeholder;
            document.querySelectorAll('[data-ai-mode]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.aiMode === currentAiMode);
            });
            renderAiContextPanel();
            renderAiResultPanel();
            updateAiRunButton();
            updateAiSettingsStatus(getAiAssistantReadyMessage(), !isRemoteAiReady() && aiConfig.remoteEnabled);
        }

        function getAiTodoOptions() {
            return [...data.todos]
                .filter(todo => !todo.done)
                .sort(compareTodosForFocus)
                .slice(0, 40);
        }

        function getAiIdeaOptions() {
            return [...data.records]
                .filter(record => record.type === '灵感碎片' && (isIdeaUnprocessed(record) || ideaNeedsConclusion(record)))
                .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')))
                .slice(0, 40);
        }

        function getAiDiaryOptions() {
            return [...data.records]
                .filter(record => record.type === '日记' && String(record.content || '').trim())
                .sort((a, b) => getRecordSortValue(b).localeCompare(getRecordSortValue(a)))
                .slice(0, 40);
        }

        function getLatestDiaryRecord() {
            return [...data.records]
                .filter(record => record.type === '日记')
                .sort((a, b) => getRecordSortValue(b).localeCompare(getRecordSortValue(a)))[0] || null;
        }

        function getTodayDiaryRecord() {
            const today = getTodayStr();
            return data.records.find(record => record.type === '日记' && record.startDate === today) || null;
        }

        function getSelectedAiTodo() {
            const options = getAiTodoOptions();
            const selectedId = document.getElementById('ai-context-todo')?.value || currentTodoId || options[0]?.id || '';
            return data.todos.find(todo => todo.id === selectedId) || options[0] || null;
        }

        function getSelectedAiIdea() {
            const options = getAiIdeaOptions();
            const selectedId = document.getElementById('ai-context-idea')?.value || options[0]?.id || '';
            return data.records.find(record => record.id === selectedId) || options[0] || null;
        }

        function getSelectedAiDiary() {
            const options = getAiDiaryOptions();
            const selectedId = document.getElementById('ai-context-diary')?.value || currentAiSourceRecordId || options[0]?.id || '';
            return data.records.find(record => record.id === selectedId && record.type === '日记') || options[0] || null;
        }

        function renderAiContextPanel() {
            const container = document.getElementById('ai-context-panel');
            if (!container) return;
            const today = getTodayStr();
            if (currentAiMode === 'chatCapture') {
                const todayDiary = getTodayDiaryRecord();
                container.innerHTML = `
                    <div class="ai-context-title">整理规则</div>
                    <div class="ai-context-summary">
                        你可以像聊天一样输入一整段话。AI 会先纠错和整理，再给出可能去向；不会自动写入，必须点下方按钮确认。
                        ${todayDiary ? `<br><strong>当前可追加日记：</strong>${escapeHtml(todayDiary.title || todayDiary.startDate || '未命名日记')}` : '<br><strong>日记：</strong>今天还没有日记，确认写入时会新建一篇。'}
                    </div>
                `;
                return;
            }
            if (currentAiMode === 'diaryReview') {
                const options = getAiDiaryOptions();
                const selected = getSelectedAiDiary();
                container.innerHTML = `
                    <div class="ai-context-title">选择日记</div>
                    ${options.length ? `
                        <select id="ai-context-diary" onchange="currentAiSourceRecordId = this.value; renderAiContextPanel()">
                            ${options.map(record => `<option value="${escapeHtml(record.id)}" ${selected?.id === record.id ? 'selected' : ''}>${escapeHtml(record.title || record.startDate || '未命名日记')}</option>`).join('')}
                        </select>
                        <div class="ai-context-summary">${renderAiDiaryContext(selected)}</div>
                    ` : '<div class="empty-state compact-empty">暂无可分析的日记，先写一篇日记再试试。</div>'}
                `;
                return;
            }
            if (currentAiMode === 'todoBreakdown') {
                const options = getAiTodoOptions();
                const selected = getSelectedAiTodo();
                container.innerHTML = `
                    <div class="ai-context-title">选择待办</div>
                    ${options.length ? `
                        <select id="ai-context-todo" onchange="renderAiContextPanel()">
                            ${options.map(todo => `<option value="${escapeHtml(todo.id)}" ${selected?.id === todo.id ? 'selected' : ''}>${escapeHtml(todo.text || '未命名待办')}</option>`).join('')}
                        </select>
                        <div class="ai-context-summary">${renderAiTodoContext(selected)}</div>
                    ` : '<div class="empty-state compact-empty">暂无可拆解的未完成待办</div>'}
                `;
                return;
            }
            if (currentAiMode === 'ideaNext') {
                const options = getAiIdeaOptions();
                const selected = getSelectedAiIdea();
                container.innerHTML = `
                    <div class="ai-context-title">选择灵感</div>
                    ${options.length ? `
                        <select id="ai-context-idea" onchange="renderAiContextPanel()">
                            ${options.map(record => `<option value="${escapeHtml(record.id)}" ${selected?.id === record.id ? 'selected' : ''}>${escapeHtml(record.title || record.content || '未命名灵感')}</option>`).join('')}
                        </select>
                        <div class="ai-context-summary">${renderAiIdeaContext(selected)}</div>
                    ` : '<div class="empty-state compact-empty">暂无待处理或待写结论的灵感</div>'}
                `;
                return;
            }
            const todayTodos = data.todos.filter(todo => isTodoRelevantToday(todo) && !todo.done).sort(compareTodosForFocus);
            const floatingTodos = data.todos.filter(todo => !todo.done && !todo.dueDate && !todo.planStartDate && !todo.planEndDate).sort(compareTodosForFocus);
            const activeGoals = data.goals.filter(goal => goal.status === '进行中');
            const dueHabits = data.habits.filter(habit => isHabitDueToday(habit));
            const staleIdeas = getAiIdeaOptions();
            container.innerHTML = `
                <div class="ai-context-title">当前上下文</div>
                <div class="ai-context-metrics">
                    <span>今日未完成 ${todayTodos.length}</span>
                    <span>无截止池 ${floatingTodos.length}</span>
                    <span>进行中目标 ${activeGoals.length}</span>
                    <span>今日习惯 ${dueHabits.length}</span>
                    <span>待处理灵感 ${staleIdeas.length}</span>
                </div>
                <div class="ai-context-summary">
                    <strong>今天：</strong>${escapeHtml(formatDate(today))}
                    ${todayTodos[0] ? `<br><strong>优先待办：</strong>${escapeHtml(todayTodos[0].text || '')}` : ''}
                    ${activeGoals[0] ? `<br><strong>目标：</strong>${escapeHtml(activeGoals[0].name || '')} ${Number(activeGoals[0].progress || 0)}%` : ''}
                </div>
            `;
        }

        function renderAiTodoContext(todo) {
            if (!todo) return '';
            const lines = [
                `紧急度：${getTodoUrgencyMeta(todo.urgency).label}`,
                `分组：${todo.group || '其他'}`,
                `日期：${formatTodoDueDate(todo)}`,
                todo.note ? `备注：${todo.note}` : '',
                (todo.subTodos || []).length ? `已有子任务：${(todo.subTodos || []).map(sub => sub.text).join('、')}` : ''
            ].filter(Boolean);
            return lines.map(line => escapeHtml(line)).join('<br>');
        }

        function renderAiIdeaContext(record) {
            if (!record) return '';
            const lines = [
                `状态：${getIdeaStatus(record)}`,
                record.ideaTags?.length ? `标签：${record.ideaTags.join('、')}` : '',
                record.content ? `内容：${record.content}` : '',
                record.ideaNextAction ? `下一步：${record.ideaNextAction}` : '',
                record.ideaConclusion ? `结论：${record.ideaConclusion}` : ''
            ].filter(Boolean);
            return lines.map(line => escapeHtml(line)).join('<br>');
        }

        function renderAiDiaryContext(record) {
            if (!record) return '';
            const values = getDiaryTemplateValues(record);
            const lines = [
                `日期：${getRecordDateRangeLabel(record)}`,
                record.title ? `标题：${record.title}` : '',
                values.oneLine ? `一句话：${values.oneLine}` : '',
                values.review ? `已有复盘：${values.review}` : '',
                values.tomorrow ? `已有明日重点：${values.tomorrow}` : '',
                record.content ? `正文预览：${String(record.content).replace(/\s+/g, ' ').slice(0, 180)}` : ''
            ].filter(Boolean);
            return lines.map(line => escapeHtml(line)).join('<br>');
        }

        function compactAiTodo(todo) {
            return {
                id: todo.id,
                text: todo.text || '',
                note: todo.note || '',
                group: todo.group || '其他',
                urgency: todo.urgency || 'medium',
                dueDate: todo.dueDate || '',
                planStartDate: todo.planStartDate || '',
                planEndDate: todo.planEndDate || '',
                overdueDays: getTodoOverdueDays(todo),
                subTodos: (todo.subTodos || []).map(sub => ({ text: sub.text || '', done: !!sub.done })),
                sessions: (todo.sessions || []).map(session => ({ date: session.date || '', startTime: session.startTime || '', note: session.note || '' }))
            };
        }

        function compactAiIdea(record) {
            return {
                id: record.id,
                title: record.title || '',
                content: record.content || '',
                status: getIdeaStatus(record),
                tags: record.ideaTags || [],
                nextAction: record.ideaNextAction || '',
                conclusion: record.ideaConclusion || '',
                startDate: record.startDate || ''
            };
        }

        function compactAiRecord(record) {
            if (!record) return {};
            return {
                id: record.id || '',
                type: record.type || '',
                title: record.title || '',
                startDate: record.startDate || '',
                endDate: record.endDate || '',
                recordTime: record.recordTime || '',
                content: record.content || '',
                templateId: record.templateId || '',
                fields: record.type === '日记' ? getDiaryTemplateValues(record) : {}
            };
        }

        function buildAiPayload() {
            const today = getTodayStr();
            const userInput = document.getElementById('ai-user-input')?.value.trim() || '';
            const base = {
                mode: currentAiMode,
                title: AI_MODE_META[currentAiMode]?.title || 'AI 助手',
                today,
                userInput,
                context: {
                    todayTodos: data.todos.filter(todo => isTodoRelevantToday(todo) && !todo.done).sort(compareTodosForFocus).slice(0, 10).map(compactAiTodo),
                    overdueTodos: data.todos.filter(todo => isTodoOverdue(todo)).sort(compareTodosForFocus).slice(0, 10).map(compactAiTodo),
                    floatingTodos: data.todos.filter(todo => !todo.done && !todo.dueDate && !todo.planStartDate && !todo.planEndDate).sort(compareTodosForFocus).slice(0, 12).map(compactAiTodo),
                    activeGoals: data.goals.filter(goal => goal.status === '进行中').slice(0, 8),
                    dueHabits: data.habits.filter(habit => isHabitDueToday(habit)).map(habit => ({ id: habit.id, name: habit.name, doneToday: getCheckinCount(habit.id, today) > 0 })),
                    ideas: getAiIdeaOptions().slice(0, 8).map(compactAiIdea),
                    recentRecords: [...data.records].sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || ''))).slice(0, 8).map(record => ({
                        type: record.type || '',
                        title: record.title || '',
                        startDate: record.startDate || '',
                        content: String(record.content || '').slice(0, 280)
                    }))
                }
            };
            if (currentAiMode === 'todoBreakdown') {
                base.context.selectedTodo = compactAiTodo(getSelectedAiTodo() || {});
                base.instruction = '把 selectedTodo 拆成 3-6 个可直接勾选的子任务，items 每项就是一个子任务。';
            } else if (currentAiMode === 'ideaNext') {
                base.context.selectedIdea = compactAiIdea(getSelectedAiIdea() || {});
                base.instruction = '把 selectedIdea 转成 1-3 个最小验证行动，第一项应适合创建为关联待办。';
            } else if (currentAiMode === 'diaryReview') {
                const diary = getSelectedAiDiary();
                base.context.selectedDiary = compactAiRecord(diary);
                base.instruction = [
                    '分析 selectedDiary，不要自动替用户下结论太满。',
                    '返回 diary.review：适合写入日记“复盘”的 2-5 句中文。',
                    '返回 diary.tomorrow：适合写入“明日重点”的 1-3 条短句；若文中明确是周末/下周安排，明日重点可概括这些打算，不要硬改成今天。',
                    '可选 diary.oneLine/improve/thinking/smallJoy；items 返回 0-4 个需要用户确认创建的待办。',
                    '日记里若有多个独立打算（例如“一个…另一个…”/列表），必须拆成多条 items。',
                    '相对时间必须换算成 YYYY-MM-DD：周末/本周末=最近周六到周日；下周末=再下一组周六日；明天/后天/周X 同理。禁止把“周末”默认成今天。',
                    'items 尽量填 planStartDate/planEndDate；模糊时段 dueDate 可等于 planEndDate；完全无时间则日期留空让用户改。',
                    '所有写入都需要用户点击确认，所以建议要可编辑、短、具体。'
                ].join('\n');
            } else if (currentAiMode === 'chatCapture') {
                base.context.latestDiary = compactAiRecord(getLatestDiaryRecord());
                base.instruction = [
                    '把 userInput 当作用户随口对话，不要要求格式。',
                    '先修正明显错别字、标点和语序，返回 capture.cleanText。',
                    '判断适合放到哪里：待办、工作记录、日记、日计划、灵感碎片。',
                    '适合创建待办的内容放到 items，items 必须短、可执行；多个打算拆多条。',
                    'items 的相对时间（周末/明天/下周X）换算成 planStartDate/planEndDate/dueDate，禁止无依据默认今天。',
                    '适合追加到日记的内容放到 capture.diaryText。',
                    '适合工作记录的内容放到 capture.workText。',
                    '适合计划/明日重点的内容放到 capture.planText。',
                    '适合作为想法保存的内容放到 capture.ideaText。',
                    'capture.suggestedTargets 返回中文数组，例如 ["待办","日记"]。',
                    '不要自动写入，所有结果都是等待用户确认的草稿。'
                ].join('\n');
            } else if (currentAiMode === 'backlogTriage') {
                base.instruction = '从 overdueTodos、floatingTodos 和 todayTodos 里挑 3-5 个最值得今天推进的小行动。';
            } else {
                base.instruction = '生成 3-5 个今日行动建议，兼顾待办、习惯、目标和近期记录。';
            }
            return base;
        }

        function cleanAiCaptureText(text = '') {
            return aiService.cleanCaptureText(text);
        }

        function getAiCaptureSentences(text = '') {
            return aiService.getCaptureSentences(text);
        }

        function extractAiCaptureTodoItems(cleanText, today) {
            return aiService.extractCaptureTodoItems(cleanText, today);
        }

        function generateLocalAiCaptureResult(payload) {
            return aiService.generateLocalCaptureResult(payload);
        }

        function generateLocalAiResult(payload) {
            return aiService.generateLocalAiResult(payload);
        }

        function refineAiResultDates(result, mode = currentAiMode) {
            if (!result || !Array.isArray(result.items) || !result.items.length) return result;
            if (mode !== 'diaryReview' && mode !== 'chatCapture') return result;
            const today = getTodayStr();
            result.items = result.items.map(item => {
                const refined = aiService.applyResolvedDatesToItem(item, today, {
                    fallbackDate: '',
                    preferResolved: true,
                    stripDateFromText: false
                });
                if (refined.planStartDate && !refined.planEndDate) refined.planEndDate = refined.planStartDate;
                if (!refined.dueDate && refined.planEndDate) refined.dueDate = refined.planEndDate;
                if (!refined.planStartDate && refined.dueDate) {
                    refined.planStartDate = refined.dueDate;
                    refined.planEndDate = refined.dueDate;
                }
                return refined;
            });
            return result;
        }

        async function runAiAssistant() {
            if (isAiAssistantRunning) return;
            setAiAssistantRunning(true);
            try {
                const payload = buildAiPayload();
                const useRemote = isRemoteAiReady();
                updateAiSettingsStatus(useRemote ? '正在请求远程 AI...' : '远程 AI 未配置或配置不完整，正在使用本地规则生成建议...');
                aiLastResult = refineAiResultDates(
                    useRemote
                        ? await requestRemoteAi(payload)
                        : generateLocalAiResult(payload),
                    currentAiMode
                );
                renderAiResultPanel();
                updateAiSettingsStatus(useRemote ? 'AI 建议已生成。' : '本地规则建议已生成。需要远程 AI 时，请从页面侧栏的 AI 设置完成配置。');
            } catch (err) {
                try {
                    const localResult = refineAiResultDates(generateLocalAiResult(buildAiPayload()), currentAiMode);
                    aiLastResult = localResult;
                    renderAiResultPanel();
                    updateAiSettingsStatus(`远程 AI 报错：${err.message || '请求失败'}\n已改用本地规则生成建议。`, true);
                } catch (fallbackErr) {
                    updateAiSettingsStatus(`AI 生成失败：${fallbackErr.message || err.message || '请检查上下文后重试。'}`, true);
                }
            } finally {
                setAiAssistantRunning(false);
            }
        }

        function renderAiResultPanel() {
            const panel = document.getElementById('ai-result-panel');
            if (!panel) return;
            if (!aiLastResult) {
                panel.innerHTML = '';
                return;
            }
            if (currentAiMode === 'chatCapture') {
                panel.innerHTML = renderAiCaptureResultPanel();
                return;
            }
            if (currentAiMode === 'diaryReview') {
                panel.innerHTML = renderDiaryAiResultPanel();
                return;
            }
            const actionLabel = currentAiMode === 'todoBreakdown'
                ? '写入子任务'
                : currentAiMode === 'ideaNext'
                    ? '转成关联待办'
                    : '加入今日待办';
            panel.innerHTML = `
                <div class="ai-result-head">
                    <div>
                        <div class="ai-result-title">${escapeHtml(aiLastResult.title)}</div>
                        ${aiLastResult.summary ? `<div class="ai-result-summary">${escapeHtml(aiLastResult.summary)}</div>` : ''}
                    </div>
                    <button class="btn btn-primary" onclick="applyAiResult()">${actionLabel}</button>
                </div>
                ${aiLastResult.items.length ? `
                    <div class="ai-result-list">
                        ${aiLastResult.items.map((item, index) => renderEditableAiResultItem(item, index)).join('')}
                    </div>
                ` : '<div class="empty-state compact-empty">这次没有生成可落地的行动项</div>'}
            `;
        }

        function getAiResultDraftId(field, index) {
            return `ai-result-draft-${field}-${index}`;
        }

        function getAiResultDraftText(field, index, fallback = '') {
            const input = document.getElementById(getAiResultDraftId(field, index));
            return String(input?.value ?? fallback ?? '').trim();
        }

        function getAiResultSelectId(scope, index) {
            return `ai-result-select-${scope}-${index}`;
        }

        function isAiResultItemSelected(scope, index) {
            const checkbox = document.getElementById(getAiResultSelectId(scope, index));
            return checkbox ? checkbox.checked : true;
        }

        function getSelectedAiResultItems(scope) {
            return (aiLastResult?.items || [])
                .map((item, index) => {
                    if (!isAiResultItemSelected(scope, index)) return null;
                    const draftItem = scope === 'result' ? getEditableAiResultItemDraft(item, index) : item;
                    return draftItem ? { item: draftItem, index } : null;
                })
                .filter(Boolean);
        }

        function getEditableAiResultItemDraft(item, index) {
            const text = getAiResultDraftText('text', index, item.text || '');
            if (!text) return null;
            const planStartDate = getAiResultDraftText('plan-start', index, item.planStartDate || '');
            const planEndDate = getAiResultDraftText('plan-end', index, item.planEndDate || planStartDate || '');
            const dueDate = getAiResultDraftText('due', index, item.dueDate || planEndDate || '');
            return {
                ...item,
                text,
                note: getAiResultDraftText('note', index, item.note || item.reason || ''),
                group: getAiResultDraftText('group', index, item.group || '其他') || '其他',
                urgency: getAiResultDraftText('urgency', index, item.urgency || 'medium') || 'medium',
                planStartDate,
                planEndDate: planEndDate || planStartDate,
                dueDate
            };
        }

        function getAiResultSingleActionLabel() {
            if (currentAiMode === 'todoBreakdown') return '写入这条';
            if (currentAiMode === 'ideaNext') return '转成待办';
            return '加入待办';
        }

        function renderAiTodoDateFields(planStartId, planEndId, dueId, item = {}) {
            const hint = item.dateHint ? `<div class="ai-date-hint">识别时间：${escapeHtml(item.dateHint)}</div>` : '';
            return `
                <div class="ai-capture-todo-dates">
                    <label>
                        <span>计划开始</span>
                        <input id="${planStartId}" type="date" value="${escapeHtml(item.planStartDate || '')}">
                    </label>
                    <label>
                        <span>计划结束</span>
                        <input id="${planEndId}" type="date" value="${escapeHtml(item.planEndDate || item.planStartDate || '')}">
                    </label>
                    <label>
                        <span>截止</span>
                        <input id="${dueId}" type="date" value="${escapeHtml(item.dueDate || item.planEndDate || '')}">
                    </label>
                </div>
                ${hint}
            `;
        }

        function renderEditableAiResultItem(item, index) {
            const isSubTask = currentAiMode === 'todoBreakdown';
            const urgency = TODO_URGENCY_META[item.urgency] ? item.urgency : 'medium';
            const titleLabel = isSubTask ? '子任务标题' : '待办标题';
            return `
                <div class="ai-result-item ai-result-draft" data-index="${index}">
                    <div class="ai-result-item-head">
                        <label class="ai-result-select">
                            <input type="checkbox" id="${getAiResultSelectId('result', index)}" checked>
                            <strong>${index + 1}. ${escapeHtml(item.text || '使用这条建议')}</strong>
                        </label>
                        <button type="button" class="btn btn-secondary todo-mini-btn" onclick="applyAiResultItem(${index})">${escapeHtml(getAiResultSingleActionLabel())}</button>
                    </div>
                    <label>
                        <span>${titleLabel}</span>
                        <input id="${getAiResultDraftId('text', index)}" value="${escapeHtml(item.text || '')}">
                    </label>
                    <label>
                        <span>备注</span>
                        <textarea id="${getAiResultDraftId('note', index)}" rows="2">${escapeHtml(item.note || item.reason || '')}</textarea>
                    </label>
                    ${isSubTask ? '' : `
                        <div class="ai-result-draft-meta">
                            <label>
                                <span>分组</span>
                                <input id="${getAiResultDraftId('group', index)}" value="${escapeHtml(item.group || '其他')}">
                            </label>
                            <label>
                                <span>优先级</span>
                                <select id="${getAiResultDraftId('urgency', index)}">
                                    ${Object.entries(TODO_URGENCY_META).map(([value, meta]) => `<option value="${escapeHtml(value)}" ${urgency === value ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`).join('')}
                                </select>
                            </label>
                        </div>
                        ${renderAiTodoDateFields(
                            getAiResultDraftId('plan-start', index),
                            getAiResultDraftId('plan-end', index),
                            getAiResultDraftId('due', index),
                            item
                        )}
                    `}
                </div>
            `;
        }

        function getAiCaptureDraftId(key) {
            return `ai-capture-draft-${key}`;
        }

        function getAiCaptureDraftText(key, fallback = '') {
            const input = document.getElementById(getAiCaptureDraftId(key));
            return String(input?.value ?? fallback ?? '').trim();
        }

        function getDiaryAiDraftId(key) {
            return getAiCaptureDraftId(`diary-${key}`);
        }

        function getDiaryAiDraftText(key, fallback = '') {
            const input = document.getElementById(getDiaryAiDraftId(key));
            return String(input?.value ?? fallback ?? '').trim();
        }

        function renderAiCaptureSection(label, key, value, actionLabel, action) {
            if (!value) return '';
            return `
                <div class="ai-capture-section">
                    <div>
                        <strong>${escapeHtml(label)}</strong>
                        <textarea id="${getAiCaptureDraftId(key)}" class="ai-capture-draft" rows="4">${escapeHtml(value)}</textarea>
                    </div>
                    <button class="btn btn-secondary todo-mini-btn" onclick="${action}">${escapeHtml(actionLabel)}</button>
                </div>
            `;
        }

        function renderDiaryAiSection(section) {
            return `
                <div class="diary-ai-section">
                    <div>
                        <strong>${escapeHtml(section.label)}</strong>
                        <textarea id="${getDiaryAiDraftId(section.key)}" class="ai-capture-draft diary-ai-draft" rows="4">${escapeHtml(section.value || '')}</textarea>
                    </div>
                    <button class="btn btn-secondary todo-mini-btn" onclick="applyDiaryAiSections(['${section.key}'])">${escapeHtml(section.action)}</button>
                </div>
            `;
        }

        function renderAiCaptureTodoDraft(item, index) {
            return `
                <div class="ai-result-item ai-capture-todo-draft" data-index="${index}">
                    <div class="ai-result-item-head">
                        <label class="ai-result-select">
                            <input type="checkbox" id="${getAiResultSelectId('capture-todo', index)}" checked>
                            <strong>创建这条待办</strong>
                        </label>
                        <button type="button" class="btn btn-secondary todo-mini-btn" onclick="applyAiCaptureTodo(${index})">只创建这条</button>
                    </div>
                    <label>
                        <span>待办标题</span>
                        <input id="${getAiCaptureDraftId(`todo-text-${index}`)}" value="${escapeHtml(item.text || '')}">
                    </label>
                    <label>
                        <span>备注</span>
                        <textarea id="${getAiCaptureDraftId(`todo-note-${index}`)}" rows="2">${escapeHtml(item.note || '')}</textarea>
                    </label>
                    <div class="ai-capture-todo-meta">
                        <label>
                            <span>分组</span>
                            <input id="${getAiCaptureDraftId(`todo-group-${index}`)}" value="${escapeHtml(item.group || '其他')}">
                        </label>
                    </div>
                    ${renderAiTodoDateFields(
                        getAiCaptureDraftId(`todo-plan-start-${index}`),
                        getAiCaptureDraftId(`todo-plan-end-${index}`),
                        getAiCaptureDraftId(`todo-due-${index}`),
                        item
                    )}
                </div>
            `;
        }

        function getDiaryAiExistingMatch(item = {}, record = null) {
            const target = record || getDiaryAiTargetRecord();
            if (!target || !item?.text) return null;
            const linkedIds = Array.isArray(target.todoIds) ? target.todoIds : [];
            const linkedTodos = data.todos.filter(todo => linkedIds.includes(todo.id));
            const sourceTodos = data.todos.filter(todo => todo.sourceRecordId === target.id || todo.sourceType === 'diary-ai');
            const candidates = [];
            const seen = new Set();
            [...linkedTodos, ...sourceTodos, ...data.todos].forEach(todo => {
                if (!todo?.id || seen.has(todo.id)) return;
                seen.add(todo.id);
                candidates.push(todo);
            });
            return todosService.findMatchingTodo(candidates, {
                text: item.text,
                sourceMatchKey: item.sourceMatchKey || item.matchKey || item.text,
                planStartDate: item.planStartDate || '',
                dueDate: item.dueDate || '',
                sourceRecordId: target.id
            }, {
                sourceRecordId: target.id,
                linkedTodoIds: linkedIds,
                threshold: 0.72
            });
        }

        function formatDiaryAiExistingMatchHint(match) {
            if (!match?.todo) return '';
            const todo = match.todo;
            const status = todo.done ? '已完成' : '未完成';
            const dateLabel = formatTodoDueDate(todo) || getTodoPlanLabel(todo) || '';
            const scoreLabel = match.score >= 0.95 ? '高度相似' : '疑似相同';
            return `已创建：${todo.text || '未命名待办'}（${status}${dateLabel ? ` · ${dateLabel}` : ''} · ${scoreLabel}）`;
        }

        function renderDiaryAiTodoDraft(item, index) {
            const match = getDiaryAiExistingMatch(item);
            const checked = match ? '' : 'checked';
            const existingClass = match ? ' is-existing' : '';
            const existingHint = match
                ? `<div class="ai-existing-hint"><span>${escapeHtml(formatDiaryAiExistingMatchHint(match))}</span><button type="button" class="btn btn-secondary todo-mini-btn" onclick="openTodoDetail(${escapeJsArg(match.todo.id)})">查看已有</button></div>`
                : '';
            return `
                <div class="ai-result-item ai-capture-todo-draft${existingClass}" data-index="${index}">
                    <div class="ai-result-item-head">
                        <label class="ai-result-select">
                            <input type="checkbox" id="${getAiResultSelectId('diary-todo', index)}" ${checked}>
                            <strong>${match ? '已创建（可再勾选重建）' : '创建这条待办'}</strong>
                        </label>
                        <button type="button" class="btn btn-secondary todo-mini-btn" onclick="applyDiaryAiTodo(${index})">${match ? '仍创建这条' : '只创建这条'}</button>
                    </div>
                    ${existingHint}
                    <label>
                        <span>待办标题</span>
                        <input id="${getDiaryAiDraftId(`todo-text-${index}`)}" value="${escapeHtml(item.text || '')}">
                    </label>
                    <label>
                        <span>备注</span>
                        <textarea id="${getDiaryAiDraftId(`todo-note-${index}`)}" rows="2">${escapeHtml(item.note || '')}</textarea>
                    </label>
                    <div class="ai-capture-todo-meta">
                        <label>
                            <span>分组</span>
                            <input id="${getDiaryAiDraftId(`todo-group-${index}`)}" value="${escapeHtml(item.group || '其他')}">
                        </label>
                    </div>
                    ${renderAiTodoDateFields(
                        getDiaryAiDraftId(`todo-plan-start-${index}`),
                        getDiaryAiDraftId(`todo-plan-end-${index}`),
                        getDiaryAiDraftId(`todo-due-${index}`),
                        item
                    )}
                </div>
            `;
        }

        function getAiCaptureTodoDrafts() {
            return (aiLastResult?.items || []).map((item, index) => {
                if (!isAiResultItemSelected('capture-todo', index)) return null;
                return getAiCaptureTodoDraftByIndex(index);
            }).filter(Boolean);
        }

        function getDiaryAiTodoDrafts() {
            return (aiLastResult?.items || []).map((item, index) => {
                if (!isAiResultItemSelected('diary-todo', index)) return null;
                return getDiaryAiTodoDraftByIndex(index);
            }).filter(Boolean);
        }

        function renderAiCaptureResultPanel() {
            const capture = aiLastResult?.capture || {};
            const targets = capture.suggestedTargets || [];
            const todoCount = aiLastResult.items?.length || 0;
            const sections = [
                renderAiCaptureSection('日记草稿', 'diaryText', capture.diaryText || capture.cleanText, '追加到日记', "applyAiCaptureToDiary()"),
                renderAiCaptureSection('工作记录草稿', 'workText', capture.workText, '创建工作记录', "applyAiCaptureRecord('工作记录')"),
                renderAiCaptureSection('计划草稿', 'planText', capture.planText, '写入日计划', "applyAiCaptureRecord('日计划')"),
                renderAiCaptureSection('灵感草稿', 'ideaText', capture.ideaText, '存为灵感', "applyAiCaptureRecord('灵感碎片')")
            ].filter(Boolean).join('');
            return `
                <div class="ai-result-head">
                    <div>
                        <div class="ai-result-title">${escapeHtml(aiLastResult.title)}</div>
                        ${aiLastResult.summary ? `<div class="ai-result-summary">${escapeHtml(aiLastResult.summary)}</div>` : ''}
                        ${targets.length ? `<div class="ai-target-row">${targets.map(target => `<span>${escapeHtml(target)}</span>`).join('')}</div>` : ''}
                    </div>
                </div>
                ${sections ? `<div class="ai-capture-section-list">${sections}</div>` : '<div class="empty-state compact-empty">这次没有整理出可写入内容，请多说一点上下文。</div>'}
                ${todoCount ? `
                    <div class="ai-result-list ai-capture-todos">
                        <div class="record-preview-heading">建议待办（需确认创建）</div>
                        ${aiLastResult.items.map((item, index) => renderAiCaptureTodoDraft(item, index)).join('')}
                        <button class="btn btn-primary" onclick="applyAiCaptureTodos()">创建这些待办</button>
                    </div>
                ` : ''}
            `;
        }

        function renderDiaryAiResultPanel() {
            const diary = aiLastResult?.diary || {};
            const sections = [
                { key: 'review', label: '复盘', value: diary.review, action: '写入复盘' },
                { key: 'tomorrow', label: '明日重点', value: diary.tomorrow, action: '写入明日重点' },
                { key: 'oneLine', label: '今日一句话', value: diary.oneLine, action: '写入一句话' },
                { key: 'improve', label: '待改进', value: diary.improve, action: '写入待改进' },
                { key: 'thinking', label: '思考', value: diary.thinking, action: '写入思考' },
                { key: 'smallJoy', label: '小确幸', value: diary.smallJoy, action: '写入小确幸' }
            ].filter(section => section.value);
            const todoCount = aiLastResult.items?.length || 0;
            const existingCount = (aiLastResult.items || []).filter(item => getDiaryAiExistingMatch(item)).length;
            return `
                <div class="ai-result-head">
                    <div>
                        <div class="ai-result-title">${escapeHtml(aiLastResult.title)}</div>
                        ${aiLastResult.summary ? `<div class="ai-result-summary">${escapeHtml(aiLastResult.summary)}</div>` : ''}
                        ${existingCount ? `<div class="ai-result-summary">其中 ${existingCount} 条与已有待办相似，默认不重复创建；需要时可手动勾选。</div>` : ''}
                    </div>
                </div>
                ${sections.length ? `
                    <div class="diary-ai-section-list">
                        ${sections.map(section => renderDiaryAiSection(section)).join('')}
                    </div>
                    <div class="diary-ai-actions">
                        <button class="btn btn-primary" onclick="applyDiaryAiSections(['review','tomorrow'])">写入复盘 + 明日重点</button>
                    </div>
                ` : '<div class="empty-state compact-empty">这次没有生成可写入日记的内容</div>'}
                ${todoCount ? `
                    <div class="ai-result-list">
                        <div class="record-preview-heading">建议待办（需确认创建）</div>
                        ${aiLastResult.items.map((item, index) => renderDiaryAiTodoDraft(item, index)).join('')}
                        <button class="btn btn-primary" onclick="applyDiaryAiTodos()">创建这些待办</button>
                    </div>
                ` : ''}
            `;
        }

        function createTodoFromAiItem(item, overrides = {}) {
            return todosService.createTodoFromAiItem(item, overrides);
        }

        function getAiResultItemsForApply(onlyIndex = null) {
            if (!aiLastResult?.items?.length) return [];
            if (onlyIndex == null) {
                return getSelectedAiResultItems('result').map(({ item }) => item);
            }
            const source = aiLastResult.items[onlyIndex];
            if (!source) return [];
            const draftItem = getEditableAiResultItemDraft(source, onlyIndex);
            return draftItem ? [draftItem] : [];
        }

        function applyAiResult(onlyIndex = null) {
            if (!aiLastResult?.items?.length) {
                alert('没有可应用的 AI 建议');
                return;
            }
            if (currentAiMode === 'todoBreakdown') {
                applyAiResultToSelectedTodo(onlyIndex);
                return;
            }
            if (currentAiMode === 'ideaNext') {
                applyAiResultToSelectedIdea(onlyIndex);
                return;
            }
            const selectedItems = getAiResultItemsForApply(onlyIndex);
            if (!selectedItems.length) {
                alert(onlyIndex == null ? '请至少选择一条 AI 建议' : '这条建议标题为空，无法加入');
                return;
            }
            const todos = selectedItems.map(item => createTodoFromAiItem(item));
            data.todos.push(...todos);
            saveData();
            renderDashboard();
            renderTodoTable();
            renderAllRecords();
            alert(`已加入待办 ${todos.length} 项`);
        }

        function applyAiResultItem(index) {
            applyAiResult(index);
        }

        function applyAiResultToSelectedTodo(onlyIndex = null) {
            const todo = getSelectedAiTodo();
            if (!todo) {
                alert('没有选中的待办');
                return;
            }
            const selectedItems = getAiResultItemsForApply(onlyIndex);
            if (!selectedItems.length) {
                alert(onlyIndex == null ? '请至少选择一条子任务建议' : '这条子任务标题为空，无法写入');
                return;
            }
            if (!Array.isArray(todo.subTodos)) todo.subTodos = [];
            const existing = new Set(todo.subTodos.map(sub => sub.text));
            const additions = selectedItems
                .map(item => item.text)
                .filter(text => text && !existing.has(text))
                .map(text => ({ text, done: false }));
            if (!additions.length) {
                alert('没有新增子任务（可能已存在）');
                return;
            }
            todo.subTodos.push(...additions);
            if (aiLastResult.summary) {
                todo.note = [todo.note || '', `AI 拆解：${aiLastResult.summary}`].filter(Boolean).join('\n\n');
            }
            todo.updatedAt = getLocalDateTimeStr();
            saveData();
            tempSubTodos = JSON.parse(JSON.stringify(todo.subTodos));
            renderDashboard();
            renderTodoTable();
            renderAllRecords();
            if (currentTodoId === todo.id) {
                renderTodoDetailView();
                renderSubTodos();
            }
            alert(`已写入子任务 ${additions.length} 项`);
        }

        function applyAiResultToSelectedIdea(onlyIndex = null) {
            const idea = getSelectedAiIdea();
            if (!idea) {
                alert('没有选中的灵感');
                return;
            }
            const selectedItems = getAiResultItemsForApply(onlyIndex);
            if (!selectedItems.length) {
                alert(onlyIndex == null ? '请至少选择一条行动建议' : '这条建议标题为空，无法转成待办');
                return;
            }
            const todos = selectedItems.map(item => {
                const todo = createTodoFromAiItem(item, { dueDate: item.dueDate || getTodayStr() });
                todo.sourceType = 'idea-ai';
                return todo;
            });
            data.todos.push(...todos);
            idea.todoIds = Array.isArray(idea.todoIds) ? idea.todoIds : [];
            todos.forEach(todo => {
                if (!idea.todoIds.includes(todo.id)) idea.todoIds.push(todo.id);
            });
            idea.ideaTodoId = todos[0].id;
            idea.ideaStatus = '待实践';
            const nextLines = selectedItems.map(item => item.text).filter(Boolean);
            idea.ideaNextAction = onlyIndex == null
                ? nextLines.join('\n')
                : [idea.ideaNextAction || '', ...nextLines].filter(Boolean).join('\n');
            idea.updatedAt = getLocalDateTimeStr();
            saveData();
            renderDashboard();
            renderTodoTable();
            renderAllRecords();
            refreshKnowledgeViews();
            alert(`已转成关联待办 ${todos.length} 项，并把灵感状态更新为待实践`);
        }

        function getAiCaptureContentForType(type) {
            const capture = aiLastResult?.capture || {};
            if (type === '工作记录') return getAiCaptureDraftText('workText', capture.workText || capture.cleanText || '');
            if (type === '日计划') return getAiCaptureDraftText('planText', capture.planText || capture.cleanText || '');
            if (type === '灵感碎片') return getAiCaptureDraftText('ideaText', capture.ideaText || capture.cleanText || '');
            return capture.cleanText || '';
        }

        function getAiCaptureRecordTitle(type, content) {
            const firstLine = String(content || '').split('\n').map(line => line.trim()).find(Boolean) || '';
            const clean = firstLine.replace(/^#+\s*/, '').slice(0, 28);
            if (clean) return clean;
            return type === '灵感碎片' ? 'AI 整理的灵感' : `AI 整理的${type}`;
        }

        function appendAiCaptureSection(record, content) {
            const section = `# AI 对话整理\n${content}`;
            record.content = [record.content || '', section].filter(part => String(part).trim()).join('\n\n');
            record.updatedAt = getLocalDateTimeStr();
        }

        function createAiCaptureRecord(type, content) {
            const range = getSuggestedRangeForType(type);
            const now = getLocalDateTimeStr();
            const diaryTemplate = type === '日记' ? getDiaryTemplate() : null;
            const initialContent = diaryTemplate
                ? composeTemplateContent(diaryTemplate, { body: `AI 对话整理\n${content}` })
                : content;
            const record = {
                id: genId(),
                type,
                title: getAiCaptureRecordTitle(type, content),
                startDate: range.start,
                endDate: range.end,
                recordTime: new Date().toTimeString().slice(0, 5),
                recordEndTime: '',
                content: initialContent,
                templateId: diaryTemplate?.id || '',
                todoIds: [],
                ideaStatus: '',
                ideaTags: [],
                ideaNextAction: '',
                ideaTodoId: '',
                ideaConclusion: '',
                createdAt: now,
                updatedAt: now
            };
            if (type === '灵感碎片') {
                record.ideaStatus = '待整理';
                record.ideaTags = ['AI整理'];
            }
            data.records.push(record);
            return record;
        }

        function refreshAfterAiCapture(record = null) {
            saveData();
            renderDashboard();
            renderAllRecords();
            renderTodoTable();
            refreshKnowledgeViews();
            if (record?.id && currentPreviewRecordId === record.id) {
                const todos = data.todos.filter(todo => record.todoIds?.includes(todo.id));
                document.getElementById('record-preview-body').innerHTML = renderRecordPreview(record, todos, false);
            }
        }

        function getAiCaptureTodoDraftByIndex(index) {
            const item = aiLastResult?.items?.[index];
            if (!item) return null;
            const text = getAiCaptureDraftText(`todo-text-${index}`, item.text);
            if (!text) return null;
            const planStartDate = getAiCaptureDraftText(`todo-plan-start-${index}`, item.planStartDate || '');
            const planEndDate = getAiCaptureDraftText(`todo-plan-end-${index}`, item.planEndDate || planStartDate || '');
            const dueDate = getAiCaptureDraftText(`todo-due-${index}`, item.dueDate || planEndDate || '');
            return {
                ...item,
                text,
                note: getAiCaptureDraftText(`todo-note-${index}`, item.note || ''),
                group: getAiCaptureDraftText(`todo-group-${index}`, item.group || '其他') || '其他',
                planStartDate,
                planEndDate: planEndDate || planStartDate,
                dueDate
            };
        }

        function applyAiCaptureTodos(onlyIndex = null) {
            if (!aiLastResult?.items?.length) {
                alert('没有可创建的待办建议');
                return;
            }
            const draftItems = onlyIndex == null
                ? getAiCaptureTodoDrafts()
                : [getAiCaptureTodoDraftByIndex(onlyIndex)].filter(Boolean);
            if (!draftItems.length) {
                alert(onlyIndex == null ? '请至少选择一条待办并保留标题' : '这条待办标题为空，无法创建');
                return;
            }
            const todos = draftItems.map(item => {
                const todo = createTodoFromAiItem(item);
                todo.sourceType = 'ai-capture';
                return todo;
            });
            data.todos.push(...todos);
            refreshAfterAiCapture();
            alert(`已创建待办 ${todos.length} 项`);
        }

        function applyAiCaptureTodo(index) {
            applyAiCaptureTodos(index);
        }

        function applyAiCaptureToDiary() {
            const capture = aiLastResult?.capture || {};
            const content = getAiCaptureDraftText('diaryText', capture.diaryText || capture.cleanText || '');
            if (!content) {
                alert('没有可写入日记的整理内容');
                return;
            }
            const existingRecord = getTodayDiaryRecord();
            const record = existingRecord || createAiCaptureRecord('日记', content);
            if (!record.title) record.title = `${formatDate(record.startDate || getTodayStr())} 日记`;
            if (existingRecord) appendAiCaptureSection(record, content);
            refreshAfterAiCapture(record);
            alert(existingRecord ? '已追加到今天的日记' : '已新建今天的日记');
        }

        function applyAiCaptureRecord(type) {
            const content = getAiCaptureContentForType(type);
            if (!content) {
                alert(`没有可写入${type}的整理内容`);
                return;
            }
            if (type === '日计划') {
                const range = getSuggestedRangeForType('日计划');
                const existing = findExistingScopedRecord('日计划', range.start, range.end);
                if (existing) {
                    appendAiCaptureSection(existing, content);
                    refreshAfterAiCapture(existing);
                    alert('已追加到今天的日计划');
                    return;
                }
            }
            const record = createAiCaptureRecord(type, content);
            refreshAfterAiCapture(record);
            alert(`已创建${type}`);
        }

        function getDiaryTemplate() {
            return getBuiltInTemplate('builtin-diary-daily-review');
        }

        function getDiaryTemplateValues(record) {
            const template = getDiaryTemplate();
            if (!template) return {};
            return parseTemplateContent(template, record?.content || '');
        }

        function getDiaryAiTargetRecord() {
            const record = getSelectedAiDiary();
            return record && record.type === '日记' ? record : null;
        }

        function refreshDiaryRecordAfterAi(record) {
            renderDashboard();
            renderAllRecords();
            refreshKnowledgeViews();
            if (currentPreviewRecordId === record.id) {
                const todos = data.todos.filter(todo => record.todoIds?.includes(todo.id));
                document.getElementById('record-preview-body').innerHTML = renderRecordPreview(record, todos, false);
            }
            if (currentRecordId === record.id && document.getElementById('record-modal')?.classList.contains('active')) {
                document.getElementById('record-content').value = record.content || '';
                currentStructuredTemplateId = record.templateId || '';
                const template = getBuiltInTemplate(currentStructuredTemplateId);
                if (template) {
                    currentTemplateFields = parseTemplateContent(template, record.content || '');
                    document.getElementById('template-select').value = `builtin:${template.id}`;
                    renderStructuredTemplateEditor(template, currentTemplateFields);
                }
            }
        }

        function applyDiaryAiSections(keys = []) {
            const record = getDiaryAiTargetRecord();
            if (!record) {
                alert('没有选中的日记');
                return;
            }
            const template = getDiaryTemplate();
            if (!template) {
                alert('日记模板不存在，无法写入分块字段');
                return;
            }
            const diary = aiLastResult?.diary || {};
            const fieldValues = keys
                .map(key => [key, getDiaryAiDraftText(key, diary[key] || '')])
                .filter(([, value]) => value);
            const fieldKeys = fieldValues.map(([key]) => key);
            if (!fieldKeys.length) {
                alert('没有可写入的 AI 内容');
                return;
            }
            const values = getDiaryTemplateValues(record);
            const existingKeys = fieldKeys.filter(key => String(values[key] || '').trim());
            if (existingKeys.length && !confirm(`这些字段已有内容：${existingKeys.join('、')}。确定用 AI 建议覆盖吗？`)) return;
            fieldValues.forEach(([key, value]) => {
                values[key] = value;
            });
            record.templateId = template.id;
            record.content = composeTemplateContent(template, values);
            record.updatedAt = getLocalDateTimeStr();
            saveData();
            refreshDiaryRecordAfterAi(record);
            alert(`已写入：${fieldKeys.join('、')}`);
        }

        function getDiaryAiTodoDraftByIndex(index) {
            const item = aiLastResult?.items?.[index];
            if (!item) return null;
            const text = getDiaryAiDraftText(`todo-text-${index}`, item.text);
            if (!text) return null;
            const planStartDate = getDiaryAiDraftText(`todo-plan-start-${index}`, item.planStartDate || '');
            const planEndDate = getDiaryAiDraftText(`todo-plan-end-${index}`, item.planEndDate || planStartDate || '');
            const dueDate = getDiaryAiDraftText(`todo-due-${index}`, item.dueDate || planEndDate || '');
            return {
                ...item,
                text,
                note: getDiaryAiDraftText(`todo-note-${index}`, item.note || ''),
                group: getDiaryAiDraftText(`todo-group-${index}`, item.group || '其他') || '其他',
                planStartDate,
                planEndDate: planEndDate || planStartDate,
                dueDate
            };
        }

        function applyDiaryAiTodos(onlyIndex = null) {
            const record = getDiaryAiTargetRecord();
            if (!record) {
                alert('没有选中的日记');
                return;
            }
            if (!aiLastResult?.items?.length) {
                alert('没有可创建的待办建议');
                return;
            }
            const draftItems = onlyIndex == null
                ? getDiaryAiTodoDrafts()
                : [getDiaryAiTodoDraftByIndex(onlyIndex)].filter(Boolean);
            if (!draftItems.length) {
                alert(onlyIndex == null ? '请至少选择一条待办并保留标题' : '这条待办标题为空，无法创建');
                return;
            }

            const duplicateCount = draftItems.filter(item => getDiaryAiExistingMatch(item, record)).length;
            if (duplicateCount > 0) {
                const message = duplicateCount === draftItems.length
                    ? `选中的 ${duplicateCount} 条都与已有待办相似。仍要再创建一遍吗？`
                    : `选中项里有 ${duplicateCount} 条与已有待办相似。确定继续创建选中的 ${draftItems.length} 条吗？`;
                if (!confirm(message)) return;
            }

            const todos = draftItems.map(item => {
                const todo = createTodoFromAiItem(item, {
                    sourceType: 'diary-ai',
                    sourceRecordId: record.id,
                    sourceMatchKey: item.sourceMatchKey || item.text
                });
                todo.note = [todo.note, `来源日记：${record.title || record.startDate || '未命名日记'}`].filter(Boolean).join('\n\n');
                return todo;
            });
            data.todos.push(...todos);
            record.todoIds = Array.isArray(record.todoIds) ? record.todoIds : [];
            todos.forEach(todo => {
                if (!record.todoIds.includes(todo.id)) record.todoIds.push(todo.id);
            });
            record.updatedAt = getLocalDateTimeStr();
            saveData();
            refreshDiaryRecordAfterAi(record);
            renderTodoTable();
            renderAiResultPanel();
            alert(`已创建待办 ${todos.length} 项`);
        }

        function applyDiaryAiTodo(index) {
            applyDiaryAiTodos(index);
        }

        function getItemUpdatedTime(item) {
            return syncService.getItemUpdatedTime(item);
        }

        function getDeletedItemKey(collection, id) {
            return syncService.getDeletedItemKey(collection, id);
        }

        function markDeletedItem(collection, id, extra = {}) {
            syncService.markDeletedItem(data, collection, id, extra);
        }

        function pruneDeletedItems(target = data) {
            return syncService.pruneDeletedItems(target);
        }

        function mergeCloudData(localData, remoteData) {
            return syncService.mergeCloudData(localData, remoteData);
        }

        async function fetchRemoteData() {
            return syncService.pullJson(syncConfig, syncConfig.remotePath, value => value, getDataHash);
        }

        function rememberRemoteVersion(remote, state) {
            if (!remote) return;
            if (remote.etag) state.lastRemoteEtag = remote.etag;
        }

        function isConditionalWriteConflict(err) {
            return err?.status === 412;
        }

        async function mergeAfterConditionalWriteConflict() {
            const remote = await fetchRemoteData();
            if (!remote) throw new Error('云端版本已变化，但重新拉取时未找到同步文件');
            const beforeSnapshot = createLocalSnapshot('条件写入冲突合并前', data, {
                source: 'cloud-push',
                action: 'etag-conflict-before-merge',
                mergedWith: { label: '云端', hash: remote.hash }
            });
            const previousData = data;
            data = mergeCloudData(data, remote.data);
            createLocalSnapshot('条件写入冲突合并结果', data, {
                source: 'cloud-push',
                action: 'etag-conflict-merge-result',
                parentSnapshotId: beforeSnapshot?.id,
                parentVersion: beforeSnapshot?.version,
                parentHash: beforeSnapshot?.hash,
                mergedWith: { label: '云端', hash: remote.hash }
            });
            if (!saveDataFromSync()) {
                data = previousData;
                throw new Error('云端冲突合并数据未能写入本地存储');
            }
            syncState.dirty = true;
            syncState.lastRemoteHash = remote.hash;
            rememberRemoteVersion(remote, syncState);
            syncState.lastPullAt = new Date().toISOString();
            syncState.lastConflictAt = syncState.lastPullAt;
            saveSyncState();
            return remote;
        }

        async function syncDownFromCloud() {
            const remote = await fetchRemoteData();
            if (!remote) return false;
            const localHash = getDataHash();
            const localChanged = syncState.dirty || (!!syncState.lastRemoteHash && localHash !== syncState.lastRemoteHash) || (!syncState.lastRemoteHash && localHash !== remote.hash);
            const shouldMerge = localHash !== remote.hash;
            let beforeSnapshot = null;
            if (shouldMerge) {
                beforeSnapshot = createLocalSnapshot('手动拉取安全合并前', data, {
                    source: 'cloud-pull',
                    action: 'before-merge',
                    mergedWith: { label: '云端', hash: remote.hash }
                });
            }
            const previousData = data;
            data = shouldMerge ? mergeCloudData(data, remote.data) : remote.data;
            if (shouldMerge) {
                createLocalSnapshot('手动拉取安全合并结果', data, {
                    source: 'cloud-pull',
                    action: 'merge-result',
                    parentSnapshotId: beforeSnapshot?.id,
                    parentVersion: beforeSnapshot?.version,
                    parentHash: beforeSnapshot?.hash,
                    mergedWith: { label: '云端', hash: remote.hash }
                });
            }
            if (!saveDataFromSync()) {
                data = previousData;
                throw new Error('云端拉取数据未能写入本地存储');
            }
            syncState.dirty = shouldMerge && getDataHash() !== remote.hash;
            syncState.lastRemoteHash = remote.hash;
            rememberRemoteVersion(remote, syncState);
            syncState.lastPullAt = new Date().toISOString();
            if (!syncState.dirty) syncState.lastSyncAt = syncState.lastPullAt;
            saveSyncState();
            return syncState.dirty ? 'merged' : 'pulled';
        }

        async function syncUpToCloud(force = false, options = {}) {
            const shouldRetryConditionalConflict = options.retryOnConditionalConflict !== false;
            const localHash = getDataHash();
            if (!force && !syncState.dirty && syncState.lastRemoteHash === localHash) return false;
            createLocalSnapshot('上传云端前', data, {
                source: 'cloud-push',
                action: force ? 'force-upload' : 'upload',
                mergedWith: syncState.lastRemoteHash ? { label: '上次云端', hash: syncState.lastRemoteHash } : null
            });
            const remotePath = syncConfig.remotePath.startsWith('/') ? syncConfig.remotePath : `/${syncConfig.remotePath}`;
            let result;
            try {
                result = await syncService.pushJson(syncConfig, remotePath, data, 'life-plan', {
                    ifMatch: syncState.lastRemoteEtag || ''
                });
            } catch (err) {
                if (shouldRetryConditionalConflict && isConditionalWriteConflict(err)) {
                    await mergeAfterConditionalWriteConflict();
                    return syncUpToCloud(true, { retryOnConditionalConflict: false });
                }
                throw err;
            }
            syncState.dirty = false;
            syncState.lastRemoteHash = getDataHash();
            if (result?.etag) syncState.lastRemoteEtag = result.etag;
            syncState.lastPushAt = new Date().toISOString();
            syncState.lastSyncAt = syncState.lastPushAt;
            saveSyncState();
            return true;
        }

        async function runCloudSync(direction = 'both') {
            if (isCloudSyncing) {
                pendingCloudSync = true;
                updateSyncStatus('已有同步任务进行中，稍等一下。');
                return;
            }
            try {
                isCloudSyncing = true;
                readSyncForm();
                updateSyncStatus(`正在同步... ${formatClockTime(new Date(), true)}`);

                if (direction === 'up') {
                    const remote = await fetchRemoteData();
                    rememberRemoteVersion(remote, syncState);
                    const localHash = getDataHash();
                    const remoteChanged = remote && remote.hash !== localHash && (!syncState.lastRemoteHash || remote.hash !== syncState.lastRemoteHash);
                    if (remoteChanged) {
                        const beforeSnapshot = createLocalSnapshot('手动上传合并前', data, {
                            source: 'cloud-push',
                            action: 'before-merge',
                            mergedWith: { label: '云端', hash: remote.hash }
                        });
                        const previousData = data;
                        data = mergeCloudData(data, remote.data);
                        createLocalSnapshot('手动上传合并结果', data, {
                            source: 'cloud-push',
                            action: 'merge-result',
                            parentSnapshotId: beforeSnapshot?.id,
                            parentVersion: beforeSnapshot?.version,
                            parentHash: beforeSnapshot?.hash,
                            mergedWith: { label: '云端', hash: remote.hash }
                        });
                        if (!saveDataFromSync()) {
                            data = previousData;
                            throw new Error('云端合并数据未能写入本地存储');
                        }
                        syncState.dirty = true;
                        syncState.lastRemoteHash = remote.hash;
                        rememberRemoteVersion(remote, syncState);
                        syncState.lastConflictAt = new Date().toISOString();
                        await syncUpToCloud(true);
                        renderAfterDataChange();
                        updateSyncStatus(`云端也有变化，已先合并再上传 ${formatClockTime(new Date(), true)}`);
                        return;
                    }
                    const uploaded = await syncUpToCloud(true);
                    updateSyncStatus(uploaded ? `上传完成 ${formatClockTime(new Date(), true)}` : '本地没有变化，无需上传');
                    return;
                }

                if (direction === 'down') {
                    const pulled = await syncDownFromCloud();
                    if (!pulled) {
                        updateSyncStatus('云端还没有同步文件，请先上传到云端');
                        return;
                    }
                    if (pulled === 'merged') {
                        await syncUpToCloud(true);
                        renderAfterDataChange();
                        updateSyncStatus(`本地也有变化，已先合并再拉取并回写云端 ${formatClockTime(new Date(), true)}`);
                        return;
                    }
                    renderAfterDataChange();
                    updateSyncStatus(`拉取完成 ${formatClockTime(new Date(), true)}`);
                    return;
                }

                const remote = await fetchRemoteData();
                rememberRemoteVersion(remote, syncState);
                const localHash = getDataHash();
                const remoteHash = remote ? remote.hash : '';
                const localChanged = syncState.dirty || (!!syncState.lastRemoteHash && localHash !== syncState.lastRemoteHash) || (!syncState.lastRemoteHash && localHash !== remoteHash);
                const remoteChanged = remote && syncState.lastRemoteHash && remoteHash !== syncState.lastRemoteHash;

                if (!remote) {
                    await syncUpToCloud(true);
                    updateSyncStatus(`云端无文件，已上传本地数据 ${formatClockTime(new Date(), true)}`);
                    return;
                }

                if (!localChanged && !remoteChanged) {
                    syncState.lastPullAt = new Date().toISOString();
                    syncState.lastRemoteHash = remoteHash;
                    rememberRemoteVersion(remote, syncState);
                    syncState.dirty = false;
                    saveSyncState();
                    updateSyncStatus(`云端和本地一致，无需同步 ${formatClockTime(new Date(), true)}`);
                    return;
                }

                if (!localChanged && remoteHash !== localHash) {
                    const beforeSnapshot = createLocalSnapshot('拉取云端安全合并前', data, {
                        source: 'auto-sync',
                        action: 'before-merge',
                        mergedWith: { label: '云端', hash: remoteHash }
                    });
                    const previousData = data;
                    data = mergeCloudData(data, remote.data);
                    createLocalSnapshot('拉取云端安全合并结果', data, {
                        source: 'auto-sync',
                        action: 'merge-result',
                        parentSnapshotId: beforeSnapshot?.id,
                        parentVersion: beforeSnapshot?.version,
                        parentHash: beforeSnapshot?.hash,
                        mergedWith: { label: '云端', hash: remoteHash }
                    });
                    if (!saveDataFromSync()) {
                        data = previousData;
                        throw new Error('云端拉取合并数据未能写入本地存储');
                    }
                    syncState.dirty = getDataHash() !== remoteHash;
                    const shouldUploadMergedData = syncState.dirty;
                    syncState.lastRemoteHash = remoteHash;
                    rememberRemoteVersion(remote, syncState);
                    syncState.lastPullAt = new Date().toISOString();
                    if (!syncState.dirty) syncState.lastSyncAt = syncState.lastPullAt;
                    saveSyncState();
                    if (shouldUploadMergedData) {
                        await syncUpToCloud(true);
                    }
                    renderAfterDataChange();
                    updateSyncStatus(`${shouldUploadMergedData ? '发现云端更新，已安全合并并回传' : '发现云端更新，已安全合并'} ${formatClockTime(new Date(), true)}`);
                    return;
                }

                if (localChanged && !remoteChanged) {
                    await syncUpToCloud(false);
                    updateSyncStatus(`发现本地更新，已上传 ${formatClockTime(new Date(), true)}`);
                    return;
                }

                const beforeSnapshot = createLocalSnapshot('自动合并前', data, {
                    source: 'auto-sync',
                    action: 'before-merge',
                    mergedWith: { label: '云端', hash: remote.hash }
                });
                const previousData = data;
                data = mergeCloudData(data, remote.data);
                createLocalSnapshot('自动合并结果', data, {
                    source: 'auto-sync',
                    action: 'merge-result',
                    parentSnapshotId: beforeSnapshot?.id,
                    parentVersion: beforeSnapshot?.version,
                    parentHash: beforeSnapshot?.hash,
                    mergedWith: { label: '云端', hash: remote.hash }
                });
                if (!saveDataFromSync()) {
                    data = previousData;
                    throw new Error('云端冲突合并数据未能写入本地存储');
                }
                syncState.dirty = true;
                syncState.lastRemoteHash = remote.hash;
                rememberRemoteVersion(remote, syncState);
                syncState.lastConflictAt = new Date().toISOString();
                await syncUpToCloud(true);
                renderAfterDataChange();
                updateSyncStatus(`本地和云端都有变化，已按条目时间保守合并 ${formatClockTime(new Date(), true)}`);
            } catch (err) {
                recordCriticalFailure('云同步失败', err, { action: `cloud-sync-${direction}` });
                updateSyncStatus(err.message || '同步失败', true);
                throw err;
            } finally {
                isCloudSyncing = false;
                if (pendingCloudSync) {
                    pendingCloudSync = false;
                    queueMicrotask(() => runCloudSync('both').catch(err => updateSyncStatus(err.message || '补传同步失败', true)));
                }
            }
        }

        function scheduleAutoCloudSync(reason = '') {
            if (!syncConfig.autoSync || !syncConfig.webdavUrl) return;
            clearTimeout(autoSyncTimer);
            if (reason) updateSyncStatus(reason);
            autoSyncTimer = setTimeout(() => {
                runCloudSync('both').catch(err => updateSyncStatus(err.message || '自动同步失败', true));
            }, 20000);
        }

        function startPeriodicCloudSync() {
            clearInterval(syncIntervalTimer);
            if (!syncConfig.autoSync || !syncConfig.webdavUrl) return;
            syncIntervalTimer = setInterval(() => {
                if (document.hidden) return;
                runCloudSync('both').catch(err => updateSyncStatus(err.message || '定时同步失败', true));
            }, 300000);
        }

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && syncConfig.autoSync && syncConfig.webdavUrl) {
                runCloudSync('both').catch(err => updateSyncStatus(err.message || '恢复页面同步失败', true));
            }
            if (!document.hidden && wheelSyncConfig.autoSync && syncConfig.webdavUrl) {
                runWheelCloudSync('both', true).catch(err => updateWheelSyncStatus(err.message || '恢复页面大转盘同步失败', true));
            }
        });

        async function testCloudSync() {
            try {
                readSyncForm();
                updateSyncStatus('正在测试连接...');
                const remotePath = syncConfig.remotePath.startsWith('/') ? syncConfig.remotePath : `/${syncConfig.remotePath}`;
                const health = await syncService.healthCheck(syncConfig, remotePath);
                if (health === true) {
                    updateSyncStatus('连接成功');
                    return;
                }
                if (health === null) {
                    updateSyncStatus('连接成功，云端目录还不存在，首次上传会自动创建');
                    return;
                }
                updateSyncStatus('连接成功');
            } catch (err) {
                updateSyncStatus(err.message || '连接失败', true);
            }
        }

        async function saveSyncSettings() {
            try {
                readSyncForm();
                startPeriodicCloudSync();
                await runCloudSync('both');
            } catch (err) {
                updateSyncStatus(err.message || '保存失败', true);
            }
        }

        async function fetchRemoteWheelData() {
            return syncService.pullJson(
                syncConfig,
                wheelSyncConfig.remotePath,
                value => getWheelSnapshot(value),
                value => getWheelDataHash(getWheelSnapshot(value))
            );
        }

        async function syncWheelDownFromCloud() {
            const remote = await fetchRemoteWheelData();
            if (!remote) return false;
            const localSnapshot = getWheelSnapshot();
            const localHash = getWheelDataHash(localSnapshot);
            const localChanged = wheelSyncState.dirty || (!!wheelSyncState.lastRemoteHash && localHash !== wheelSyncState.lastRemoteHash) || (!wheelSyncState.lastRemoteHash && localHash !== remote.hash);
            const shouldMerge = localChanged && localHash !== remote.hash;
            const nextSnapshot = shouldMerge ? mergeWheelSnapshots(localSnapshot, remote.data) : remote.data;
            applyWheelSnapshot(nextSnapshot, true);
            wheelSyncState.dirty = shouldMerge;
            wheelSyncState.lastRemoteHash = remote.hash;
            rememberRemoteVersion(remote, wheelSyncState);
            wheelSyncState.lastPullAt = new Date().toISOString();
            if (!shouldMerge) wheelSyncState.lastSyncAt = wheelSyncState.lastPullAt;
            saveWheelSyncState();
            return shouldMerge ? 'merged' : 'pulled';
        }

        async function syncWheelUpToCloud(force = false, options = {}) {
            const shouldRetryConditionalConflict = options.retryOnConditionalConflict !== false;
            const localSnapshot = getWheelSnapshot();
            const localHash = getWheelDataHash(localSnapshot);
            if (!force && !wheelSyncState.dirty && wheelSyncState.lastRemoteHash === localHash) return false;
            const remotePath = wheelSyncConfig.remotePath.startsWith('/') ? wheelSyncConfig.remotePath : `/${wheelSyncConfig.remotePath}`;
            let result;
            try {
                result = await syncService.pushJson(syncConfig, remotePath, localSnapshot, 'wheel-app', {
                    ifMatch: wheelSyncState.lastRemoteEtag || ''
                });
            } catch (err) {
                if (shouldRetryConditionalConflict && isConditionalWriteConflict(err)) {
                    const remote = await fetchRemoteWheelData();
                    if (!remote) throw new Error('大转盘云端版本已变化，但重新拉取时未找到同步文件');
                    applyWheelSnapshot(mergeWheelSnapshots(localSnapshot, remote.data), false);
                    wheelSyncState.dirty = true;
                    wheelSyncState.lastRemoteHash = remote.hash;
                    rememberRemoteVersion(remote, wheelSyncState);
                    wheelSyncState.lastPullAt = new Date().toISOString();
                    wheelSyncState.lastConflictAt = wheelSyncState.lastPullAt;
                    saveWheelSyncState();
                    return syncWheelUpToCloud(true, { retryOnConditionalConflict: false });
                }
                throw err;
            }
            wheelSyncState.dirty = false;
            wheelSyncState.lastRemoteHash = getWheelDataHash();
            if (result?.etag) wheelSyncState.lastRemoteEtag = result.etag;
            wheelSyncState.lastPushAt = new Date().toISOString();
            wheelSyncState.lastSyncAt = wheelSyncState.lastPushAt;
            saveWheelSyncState();
            return true;
        }

        async function runWheelCloudSync(direction = 'both', silent = false) {
            if (isWheelCloudSyncing) {
                pendingWheelCloudSync = true;
                if (!silent) updateWheelSyncStatus('已有大转盘同步任务进行中。');
                return;
            }
            try {
                isWheelCloudSyncing = true;
                readWheelSyncForm();
                if (!syncConfig.webdavUrl) {
                    if (!silent) updateWheelSyncStatus('请先填写统一同步中转地址', true);
                    return;
                }
                if (!silent) updateWheelSyncStatus(`正在同步大转盘... ${formatClockTime(new Date(), true)}`);

                if (direction === 'up') {
                    const remote = await fetchRemoteWheelData();
                    rememberRemoteVersion(remote, wheelSyncState);
                    const localSnapshot = getWheelSnapshot();
                    const localHash = getWheelDataHash(localSnapshot);
                    const remoteChanged = remote && remote.hash !== localHash && (!wheelSyncState.lastRemoteHash || remote.hash !== wheelSyncState.lastRemoteHash);
                    if (remoteChanged) {
                        applyWheelSnapshot(mergeWheelSnapshots(localSnapshot, remote.data), false);
                        wheelSyncState.dirty = true;
                        wheelSyncState.lastRemoteHash = remote.hash;
                        rememberRemoteVersion(remote, wheelSyncState);
                        wheelSyncState.lastConflictAt = new Date().toISOString();
                        saveWheelSyncState();
                        await syncWheelUpToCloud(true);
                        renderAfterDataChange();
                        updateWheelSyncStatus(`大转盘云端也有变化，已合并后上传 ${formatClockTime(new Date(), true)}`);
                        return;
                    }
                    const uploaded = await syncWheelUpToCloud(true);
                    updateWheelSyncStatus(uploaded ? `大转盘上传完成 ${formatClockTime(new Date(), true)}` : '大转盘本地没有变化，无需上传');
                    return;
                }

                if (direction === 'down') {
                    const pulled = await syncWheelDownFromCloud();
                    if (!pulled) {
                        updateWheelSyncStatus('云端还没有大转盘文件，请先上传到云端');
                        return;
                    }
                    if (pulled === 'merged') {
                        await syncWheelUpToCloud(true);
                        renderAfterDataChange();
                        updateWheelSyncStatus(`大转盘本地也有变化，已合并后回写云端 ${formatClockTime(new Date(), true)}`);
                        return;
                    }
                    renderAfterDataChange();
                    updateWheelSyncStatus(`大转盘拉取完成 ${formatClockTime(new Date(), true)}`);
                    return;
                }

                const remote = await fetchRemoteWheelData();
                rememberRemoteVersion(remote, wheelSyncState);
                const localSnapshot = getWheelSnapshot();
                const localHash = getWheelDataHash(localSnapshot);
                const remoteHash = remote ? remote.hash : '';
                const localChanged = wheelSyncState.dirty || (!!wheelSyncState.lastRemoteHash && localHash !== wheelSyncState.lastRemoteHash) || (!wheelSyncState.lastRemoteHash && localHash !== remoteHash);
                const remoteChanged = remote && wheelSyncState.lastRemoteHash && remoteHash !== wheelSyncState.lastRemoteHash;

                if (!remote) {
                    await syncWheelUpToCloud(true);
                    updateWheelSyncStatus(`云端无大转盘文件，已上传本地数据 ${formatClockTime(new Date(), true)}`);
                    return;
                }

                if (!localChanged && !remoteChanged) {
                    wheelSyncState.lastPullAt = new Date().toISOString();
                    wheelSyncState.lastRemoteHash = remoteHash;
                    rememberRemoteVersion(remote, wheelSyncState);
                    wheelSyncState.dirty = false;
                    saveWheelSyncState();
                    if (!silent) updateWheelSyncStatus(`大转盘云端和本地一致 ${formatClockTime(new Date(), true)}`);
                    return;
                }

                if (!localChanged && remoteHash !== localHash) {
                    applyWheelSnapshot(remote.data, true);
                    wheelSyncState.dirty = false;
                    wheelSyncState.lastRemoteHash = remoteHash;
                    rememberRemoteVersion(remote, wheelSyncState);
                    wheelSyncState.lastPullAt = new Date().toISOString();
                    wheelSyncState.lastSyncAt = wheelSyncState.lastPullAt;
                    saveWheelSyncState();
                    updateWheelSyncStatus(`发现大转盘云端更新，已拉取 ${formatClockTime(new Date(), true)}`);
                    return;
                }

                if (localChanged && !remoteChanged) {
                    await syncWheelUpToCloud(false);
                    updateWheelSyncStatus(`发现大转盘本地更新，已上传 ${formatClockTime(new Date(), true)}`);
                    return;
                }

                applyWheelSnapshot(mergeWheelSnapshots(localSnapshot, remote.data), false);
                wheelSyncState.dirty = true;
                wheelSyncState.lastRemoteHash = remote.hash;
                rememberRemoteVersion(remote, wheelSyncState);
                wheelSyncState.lastConflictAt = new Date().toISOString();
                saveWheelSyncState();
                await syncWheelUpToCloud(true);
                renderAfterDataChange();
                updateWheelSyncStatus(`大转盘两端都有变化，已保守合并 ${formatClockTime(new Date(), true)}`);
            } catch (err) {
                recordCriticalFailure('大转盘同步失败', err, { action: `wheel-cloud-sync-${direction}` });
                updateWheelSyncStatus(err.message || '大转盘同步失败', true);
                throw err;
            } finally {
                isWheelCloudSyncing = false;
                if (pendingWheelCloudSync) {
                    pendingWheelCloudSync = false;
                    queueMicrotask(() => runWheelCloudSync('both', true).catch(err => updateWheelSyncStatus(err.message || '大转盘补传失败', true)));
                }
            }
        }

        function scheduleAutoWheelCloudSync(reason = '') {
            if (!wheelSyncConfig.autoSync || !syncConfig.webdavUrl) return;
            clearTimeout(wheelAutoSyncTimer);
            if (reason) updateWheelSyncStatus(reason);
            wheelAutoSyncTimer = setTimeout(() => {
                runWheelCloudSync('both', true).catch(err => updateWheelSyncStatus(err.message || '大转盘自动同步失败', true));
            }, 20000);
        }

        function startPeriodicWheelCloudSync() {
            clearInterval(wheelSyncIntervalTimer);
            if (!wheelSyncConfig.autoSync || !syncConfig.webdavUrl) return;
            wheelSyncIntervalTimer = setInterval(() => {
                if (document.hidden) return;
                runWheelCloudSync('both', true).catch(err => updateWheelSyncStatus(err.message || '大转盘定时同步失败', true));
            }, 300000);
        }

        async function testWheelCloudSync() {
            try {
                readWheelSyncForm();
                if (!syncConfig.webdavUrl) throw new Error('请先填写统一同步中转地址');
                updateWheelSyncStatus('正在测试大转盘连接...');
                const remotePath = wheelSyncConfig.remotePath.startsWith('/') ? wheelSyncConfig.remotePath : `/${wheelSyncConfig.remotePath}`;
                const health = await syncService.healthCheck(syncConfig, remotePath);
                if (health === true) {
                    updateWheelSyncStatus('大转盘连接成功');
                    return;
                }
                if (health === null) {
                    updateWheelSyncStatus('连接成功，大转盘云端目录还不存在，首次上传会自动创建');
                    return;
                }
                updateWheelSyncStatus('大转盘连接成功');
            } catch (err) {
                updateWheelSyncStatus(err.message || '大转盘连接失败', true);
            }
        }

        async function saveWheelSyncSettings() {
            try {
                readWheelSyncForm();
                startPeriodicWheelCloudSync();
                await runWheelCloudSync('both');
            } catch (err) {
                updateWheelSyncStatus(err.message || '大转盘保存失败', true);
            }
        }

        // 生成ID
        function genId() {
            return Date.now().toString(36) + Math.random().toString(36).slice(2);
        }

        function sampleRandomItems(items = [], count = 0) {
            const pool = Array.isArray(items) ? [...items] : [];
            const limit = Math.max(0, Math.min(Number(count) || 0, pool.length));
            for (let i = 0; i < limit; i++) {
                const swapIndex = i + Math.floor(Math.random() * (pool.length - i));
                [pool[i], pool[swapIndex]] = [pool[swapIndex], pool[i]];
            }
            return pool.slice(0, limit);
        }

        function padDateNumber(value) {
            return String(value).padStart(2, '0');
        }

        function formatLocalDateKey(date = new Date()) {
            return `${date.getFullYear()}-${padDateNumber(date.getMonth() + 1)}-${padDateNumber(date.getDate())}`;
        }

        // 格式化日期
        function formatDate(dateStr) {
            if (!dateStr) return '无';
            const d = parseLocalDate(dateStr);
            if (Number.isNaN(d.getTime())) return String(dateStr);
            return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
        }

        function parseLocalDate(dateStr) {
            const match = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) return new Date(dateStr);
            return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        }

        function formatDiaryTitle(dateStr = getTodayStr()) {
            const d = parseLocalDate(dateStr);
            if (Number.isNaN(d.getTime())) return '';
            const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
        }

        function isDiaryDateTitle(title = '') {
            return /^\d{4}年\d{1,2}月\d{1,2}日 星期[一二三四五六日]$/.test(String(title).trim());
        }

        function applyDiaryDefaultTitle(force = false) {
            const typeEl = document.getElementById('record-type');
            const titleEl = document.getElementById('record-title');
            const dateEl = document.getElementById('record-start-date');
            if (!typeEl || !titleEl || !dateEl || typeEl.value !== '日记') return;
            const currentTitle = titleEl.value.trim();
            if (force || !currentTitle || isDiaryDateTitle(currentTitle)) {
                titleEl.value = formatDiaryTitle(dateEl.value || getTodayStr());
            }
        }

        // 获取今日日期字符串
        function getTodayStr() {
            return formatLocalDateKey(new Date());
        }

        function getTodayBoundaryDateStr() {
            const now = new Date();
            return formatLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
        }

        function normalizeRangeDays(value, fallback = 30) {
            if (value === 'all') return 'all';
            const days = Number.parseInt(value, 10);
            return Number.isFinite(days) && days > 0 ? days : fallback;
        }

        function getRecentDateRange(days = 30) {
            const endDate = getTodayBoundaryDateStr();
            const normalizedDays = normalizeRangeDays(days, 30);
            return {
                startDate: addDays(endDate, -(normalizedDays - 1)),
                endDate
            };
        }

        function getDashboardTimelineRange() {
            return getRecentDateRange(dashboardTimelineRangeDays);
        }

        function getRecordListRange() {
            if (recordListRangeDays === 'all') return { startDate: '', endDate: '' };
            return getRecentDateRange(recordListRangeDays);
        }

        function syncTimelineRangeControls() {
            const dashboardRangeEl = document.getElementById('dashboard-timeline-range');
            if (dashboardRangeEl) {
                dashboardTimelineRangeDays = normalizeRangeDays(dashboardRangeEl.value, 30);
                dashboardRangeEl.value = String(dashboardTimelineRangeDays);
            }

            const recordRangeEl = document.getElementById('record-list-range');
            if (recordRangeEl) {
                recordListRangeDays = normalizeRangeDays(recordRangeEl.value, 30);
                recordRangeEl.value = recordListRangeDays === 'all' ? 'all' : String(recordListRangeDays);
            }
        }

        function setDashboardTimelineRange(value) {
            dashboardTimelineRangeDays = normalizeRangeDays(value, 30);
            renderTimeline();
        }

        function setRecordListRange(value) {
            recordListRangeDays = normalizeRangeDays(value, 30);
            renderAllRecords();
        }

        function getLocalDateTimeStr(date = new Date()) {
            return `${formatLocalDateKey(date)}T${padDateNumber(date.getHours())}:${padDateNumber(date.getMinutes())}:${padDateNumber(date.getSeconds())}`;
        }

        function formatClockTime(date = new Date(), withSeconds = false) {
            const base = `${padDateNumber(date.getHours())}:${padDateNumber(date.getMinutes())}`;
            return withSeconds ? `${base}:${padDateNumber(date.getSeconds())}` : base;
        }

        function formatStoredDateTime(value) {
            if (!value) return '';
            const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
            if (!match) return String(value).replace('T', ' ');
            return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}:${match[6] || '00'}`;
        }

        function formatStoredTime(value) {
            const match = String(value || '').match(/T?(\d{2}):(\d{2})(?::(\d{2}))?/);
            if (!match) return '';
            return `${match[1]}:${match[2]}${match[3] ? `:${match[3]}` : ''}`;
        }

        function composeDateTimeWithClock(dateStr, clockDate = new Date()) {
            return `${dateStr}T${padDateNumber(clockDate.getHours())}:${padDateNumber(clockDate.getMinutes())}:${padDateNumber(clockDate.getSeconds())}`;
        }

        function getRecordTime(record) {
            if (record.recordTime) return record.recordTime;
            const raw = record.createdAt || record.updatedAt || '';
            const match = raw.match(/T(\d{2}:\d{2})/);
            return match ? match[1] : '--:--';
        }

        function getRecordSortValue(record) {
            if (record.startDate && record.recordTime) return `${record.startDate}T${record.recordTime}:00`;
            return record.createdAt || record.updatedAt || `${record.startDate || record.endDate || '0000-00-00'}T00:00:00`;
        }

        function parseTimeToMinutes(value = '') {
            const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
            if (!match) return null;
            return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        }

        function formatMinutesLabel(totalMinutes) {
            const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
            const minutes = String(totalMinutes % 60).padStart(2, '0');
            return `${hours}:${minutes}`;
        }

        function getDateRangeArray(startDate, endDate) {
            const dates = [];
            if (!startDate) return dates;
            const end = endDate || startDate;
            for (let date = startDate; date <= end; date = addDays(date, 1)) {
                dates.push(date);
            }
            return dates;
        }

        function isHabitDueOnDate(habit, dateStr) {
            if (!dateStr) return false;
            if (habit.startDate && dateStr < habit.startDate) return false;

            const target = parseLocalDate(dateStr);
            const day = target.getDay();

            switch(habit.rule) {
                case 'daily':
                    return true;
                case 'weekly-fixed':
                    return habit.weekdays && habit.weekdays.includes(day.toString());
                case 'weekly-count':
                    return (target.getDay() || 7) === 1;
                case 'monthly-count':
                    return target.getDate() === 1;
                case 'interval':
                    if (!habit.startDate) return true;
                    const diff = Math.floor((target - parseLocalDate(habit.startDate)) / (1000 * 60 * 60 * 24));
                    return diff >= 0 && diff % habit.count === 0;
                default:
                    return true;
            }
        }

        function getScheduleItemTone(item) {
            const palette = {
                '日记': { bg: '#e7f1ff', border: '#6da7ef', ink: '#153b63' },
                '日计划': { bg: '#e7f1ff', border: '#6da7ef', ink: '#153b63' },
                '工作记录': { bg: '#dff7f3', border: '#3aa99e', ink: '#0f4c46' },
                '灵感碎片': { bg: '#fff0cf', border: '#dca33f', ink: '#5d4312' },
                '周复盘': { bg: '#efe8ff', border: '#8d72da', ink: '#422a76' },
                '月复盘': { bg: '#efe8ff', border: '#8d72da', ink: '#422a76' },
                '年复盘': { bg: '#efe8ff', border: '#8d72da', ink: '#422a76' },
                '周计划': { bg: '#e6f4ed', border: '#5f9b78', ink: '#183b2b' },
                '月计划': { bg: '#e6f4ed', border: '#5f9b78', ink: '#183b2b' },
                '年度计划': { bg: '#e6f4ed', border: '#5f9b78', ink: '#183b2b' },
                '3年计划': { bg: '#e6f4ed', border: '#5f9b78', ink: '#183b2b' },
                '终身愿景': { bg: '#fdebe4', border: '#d67b52', ink: '#6a2c14' },
                '待办': { bg: '#ffe8e3', border: '#dc8469', ink: '#6b2e1d' },
                '待办计划': { bg: '#eef5f0', border: '#8db29b', ink: '#274335' },
                '待办执行': { bg: '#e7f1ff', border: '#5f9ee5', ink: '#163d67' },
                '待办截止': { bg: '#ffe9df', border: '#d77f57', ink: '#743116' },
                '习惯': { bg: '#e8f3eb', border: '#6ca07c', ink: '#244c33' },
                '习惯-全天': { bg: '#e8edf4', border: '#8a96a8', ink: '#344055' },
                '习惯-晨间': { bg: '#fff1dd', border: '#d99138', ink: '#5e4214' },
                '习惯-午间': { bg: '#fff3d2', border: '#cfaf34', ink: '#5f4f11' },
                '习惯-晚间': { bg: '#f1e9ff', border: '#8c70d1', ink: '#41286f' },
                '习惯-学习': { bg: '#f1e9ff', border: '#8c70d1', ink: '#41286f' },
                '习惯-运动': { bg: '#e5f1ff', border: '#5e9feb', ink: '#153d69' },
                '习惯-工作': { bg: '#fff0df', border: '#c28a3f', ink: '#614116' },
                '习惯-生活': { bg: '#e6f4ed', border: '#5f9b78', ink: '#183b2b' }
            };

            if (item.sourceType === 'habit') {
                return palette[`习惯-${item.habitTag}`] || palette['习惯'];
            }

            return palette[item.type] || { bg: '#eef6f1', border: '#8db29b', ink: '#274335' };
        }

        function buildRecordScheduleItem(record, dateStr = record.startDate) {
            const tone = getScheduleItemTone({ sourceType: 'record', type: record.type });
            const startMinutes = parseTimeToMinutes(record.recordTime);
            const endMinutes = parseTimeToMinutes(record.recordEndTime);
            const explicitEndMinutes = startMinutes !== null && endMinutes !== null && endMinutes > startMinutes ? endMinutes : null;
            const ideaMeta = getIdeaMetaParts(record);
            const dateMeta = record.endDate && record.endDate !== record.startDate ? `${formatDate(record.startDate)} ~ ${formatDate(record.endDate)}` : '';

            return {
                key: `record:${record.id}:${dateStr}`,
                id: record.id,
                sourceType: 'record',
                type: record.type,
                filterType: record.type,
                date: dateStr,
                title: record.title || record.type,
                preview: record.content || '',
                meta: [dateMeta, ...ideaMeta].filter(Boolean).join(' · '),
                done: false,
                allDay: startMinutes === null,
                startMinutes,
                endMinutes: explicitEndMinutes,
                timeLabel: record.recordTime || '全天',
                click: `openRecordPreview('${record.id}')`,
                tone
            };
        }

        function buildTodoPlanScheduleItem(todo, dateStr) {
            const urgencyMeta = getTodoUrgencyMeta(todo);
            return {
                key: `todo-plan:${todo.id}:${dateStr}`,
                id: todo.id,
                sourceType: 'todo-plan',
                type: '待办计划',
                filterType: '待办',
                date: dateStr,
                title: `计划：${todo.text}`,
                preview: `${todo.planStartDate || dateStr} ~ ${todo.planEndDate || dateStr}`,
                meta: `${todo.group || '其他'} · ${urgencyMeta.label}`,
                done: !!todo.done,
                allDay: true,
                startMinutes: null,
                endMinutes: null,
                timeLabel: '计划',
                click: `openTodoDetail('${todo.id}')`,
                tone: getScheduleItemTone({ sourceType: 'todo', type: '待办计划' })
            };
        }

        function buildTodoDueScheduleItem(todo) {
            return {
                key: `todo-due:${todo.id}`,
                id: todo.id,
                sourceType: 'todo-due',
                type: '待办截止',
                filterType: '待办',
                date: todo.dueDate,
                title: `截止：${todo.text}`,
                preview: todo.done ? '已完成' : '到期提醒',
                meta: `${todo.group || '其他'} · ${getTodoUrgencyMeta(todo).label}`,
                done: !!todo.done,
                allDay: true,
                startMinutes: null,
                endMinutes: null,
                timeLabel: '截止',
                click: `openTodoDetail('${todo.id}')`,
                tone: getScheduleItemTone({ sourceType: 'todo', type: '待办截止' })
            };
        }

        function buildTodoSessionScheduleItem(todo, session) {
            const startMinutes = parseTimeToMinutes(session.startTime);
            const endMinutes = parseTimeToMinutes(session.endTime);
            const explicitEndMinutes = startMinutes !== null && endMinutes !== null && endMinutes > startMinutes ? endMinutes : null;
            return {
                key: `todo-session:${todo.id}:${session.id}`,
                id: todo.id,
                sourceType: 'todo-session',
                type: '待办执行',
                filterType: '待办',
                date: session.date,
                title: `执行：${todo.text}`,
                preview: session.note || `${todo.group || '其他'} 待办`,
                meta: session.endTime ? `${session.startTime || '--:--'} ~ ${session.endTime}` : (session.startTime || '执行记录'),
                done: !!todo.done,
                allDay: startMinutes === null,
                startMinutes,
                endMinutes: explicitEndMinutes,
                timeLabel: session.startTime || '执行',
                click: `openTodoDetail('${todo.id}')`,
                tone: getScheduleItemTone({ sourceType: 'todo', type: '待办执行' })
            };
        }

        function buildHabitScheduleItem(habit, dateStr) {
            const checkins = getHabitCheckinsOnDate(habit.id, dateStr);
            const count = checkins.length;
            const targetCount = getHabitTargetCount(habit);
            const tone = getScheduleItemTone({ sourceType: 'habit', type: '习惯', habitTag: habit.tag });
            const latestCheckin = checkins[checkins.length - 1];
            const checkinTime = latestCheckin ? getCheckinClockTime(latestCheckin) : '';
            const latestNote = getCheckinNoteSummary(latestCheckin?.note, 42);
            const startMinutes = parseTimeToMinutes(checkinTime);
            const updatedText = latestCheckin?.updatedAt ? ` · 更新 ${formatStoredTime(latestCheckin.updatedAt)}` : '';

            return {
                key: `habit:${habit.id}:${dateStr}:${latestCheckin?.id || 'pending'}`,
                id: habit.id,
                sourceType: 'habit',
                type: '习惯',
                filterType: '习惯',
                date: dateStr,
                title: habit.name,
                preview: count > 0
                    ? `${habit.tag || '习惯'} · ${getHabitRuleText(habit)} · 打卡 ${checkinTime || '已记录'}${latestNote ? ` · ${latestNote}` : ''}`
                    : `${habit.tag || '习惯'} · ${getHabitRuleText(habit)}`,
                meta: count > 0 ? `已打卡 ${count}/${targetCount}${updatedText}` : `待打卡 ${targetCount} 次`,
                done: count >= 1,
                allDay: !(count > 0 && startMinutes !== null),
                startMinutes: count > 0 ? startMinutes : null,
                endMinutes: null,
                timeLabel: count > 0 ? (checkinTime || '已打卡') : '待打卡',
                click: `focusHabitFromSchedule('${habit.id}')`,
                habitTag: habit.tag,
                tone
            };
        }

        function getCheckedHabitDateKeysInRange(startDate, endDate) {
            const keys = new Set();
            data.checkins.forEach(checkin => {
                if (!checkin.habitId || !checkin.date) return;
                if (checkin.date < startDate || checkin.date > endDate) return;
                keys.add(`${checkin.habitId}:${checkin.date}`);
            });
            return [...keys];
        }

        function buildScheduleItemsForRange(startDate, endDate, options = {}) {
            const {
                includeRecords = true,
                includeTodos = true,
                includeHabits = true,
                includeTodoPlans = true,
                includeTodoDue = true,
                includeTodoSessions = true,
                keyword = '',
                typeFilter = 'all'
            } = options;
            const items = [];
            const keywordText = String(keyword || '').trim().toLowerCase();

            if (includeRecords) {
                data.records.forEach(record => {
                    if (record.isHabitRecord) return;
                    if (!record.startDate) return;
                    if (record.startDate < startDate || record.startDate > endDate) return;
                    if (typeFilter !== 'all' && typeFilter !== record.type) return;

                    const item = buildRecordScheduleItem(record);
                    const haystack = [item.type, item.title, item.preview, item.meta, item.date].filter(Boolean).join(' ').toLowerCase();
                    if (!keywordText || haystack.includes(keywordText)) items.push(item);
                });
            }

            if (includeTodos && (typeFilter === 'all' || typeFilter === '待办')) {
                data.todos.forEach(todo => {
                    const pushTodoItem = item => {
                        const haystack = [item.type, item.title, item.preview, item.meta, item.date].filter(Boolean).join(' ').toLowerCase();
                        if (!keywordText || haystack.includes(keywordText)) items.push(item);
                    };

                    if (includeTodoPlans && todo.planStartDate && todo.planEndDate) {
                        const rangeStart = todo.planStartDate < startDate ? startDate : todo.planStartDate;
                        const rangeEnd = todo.planEndDate > endDate ? endDate : todo.planEndDate;
                        if (rangeStart <= rangeEnd) {
                            getDateRangeArray(rangeStart, rangeEnd).forEach(dateStr => {
                                pushTodoItem(buildTodoPlanScheduleItem(todo, dateStr));
                            });
                        }
                    }

                    if (includeTodoDue && todo.dueDate && todo.dueDate >= startDate && todo.dueDate <= endDate) {
                        pushTodoItem(buildTodoDueScheduleItem(todo));
                    }

                    if (includeTodoSessions) {
                        (todo.sessions || []).forEach(session => {
                            if (!session.date || session.date < startDate || session.date > endDate) return;
                            pushTodoItem(buildTodoSessionScheduleItem(todo, session));
                        });
                    }
                });
            }

            if (includeHabits && (typeFilter === 'all' || typeFilter === '习惯')) {
                getCheckedHabitDateKeysInRange(startDate, endDate).forEach(key => {
                    const separatorIndex = key.lastIndexOf(':');
                    const habitId = key.slice(0, separatorIndex);
                    const dateStr = key.slice(separatorIndex + 1);
                    const habit = data.habits.find(item => item.id === habitId);
                    if (!habit || !isHabitDueOnDate(habit, dateStr)) return;
                    const item = buildHabitScheduleItem(habit, dateStr);
                    if (!item.done) return;
                    const haystack = [item.type, item.title, item.preview, item.meta, item.date].filter(Boolean).join(' ').toLowerCase();
                    if (!keywordText || haystack.includes(keywordText)) items.push(item);
                });
            }

            return items;
        }

        function getScheduleSortValue(item) {
            if (!item.allDay && item.startMinutes !== null) {
                return `${item.date}T${String(Math.floor(item.startMinutes / 60)).padStart(2, '0')}:${String(item.startMinutes % 60).padStart(2, '0')}:00`;
            }
            return `${item.date}T00:00:00`;
        }

        function getScheduleLayoutEndMinutes(item, fallbackMinutes = 15) {
            if (item?.endMinutes !== null && item?.endMinutes > item?.startMinutes) return item.endMinutes;
            return Math.min((item?.startMinutes || 0) + fallbackMinutes, 23 * 60 + 59);
        }

        function sortScheduleItemsInDay(items) {
            const order = getDayOrder();
            return [...items].sort((a, b) => {
                if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
                const result = getScheduleSortValue(a).localeCompare(getScheduleSortValue(b));
                return order === 'asc' ? result : -result;
            });
        }

        function layoutTimedItems(items) {
            const sorted = [...items].sort((a, b) => {
                const startDiff = a.startMinutes - b.startMinutes;
                if (startDiff !== 0) return startDiff;
                return getScheduleLayoutEndMinutes(b) - getScheduleLayoutEndMinutes(a);
            });
            const clusters = [];
            let current = [];
            let clusterEnd = -1;

            sorted.forEach(item => {
                const itemEnd = getScheduleLayoutEndMinutes(item);
                if (current.length === 0 || item.startMinutes < clusterEnd) {
                    current.push(item);
                    clusterEnd = Math.max(clusterEnd, itemEnd);
                    return;
                }
                clusters.push(current);
                current = [item];
                clusterEnd = itemEnd;
            });
            if (current.length > 0) clusters.push(current);

            const positioned = [];
            clusters.forEach(cluster => {
                const columns = [];
                const placements = cluster.map(item => {
                    const itemEnd = getScheduleLayoutEndMinutes(item);
                    let columnIndex = columns.findIndex(columnEnd => columnEnd <= item.startMinutes);
                    if (columnIndex === -1) {
                        columnIndex = columns.length;
                        columns.push(itemEnd);
                    } else {
                        columns[columnIndex] = itemEnd;
                    }
                    return { item, columnIndex };
                });
                const columnCount = Math.max(columns.length, 1);
                placements.forEach(placement => {
                    positioned.push({
                        ...placement.item,
                        layoutColumn: placement.columnIndex,
                        layoutColumns: columnCount
                    });
                });
            });

            return positioned;
        }

        function addDays(dateStr, amount) {
            const date = parseLocalDate(dateStr);
            date.setDate(date.getDate() + amount);
            return formatLocalDateKey(date);
        }

        function getWeekStart(dateStr) {
            const date = parseLocalDate(dateStr);
            const day = date.getDay() || 7;
            date.setDate(date.getDate() - day + 1);
            return formatLocalDateKey(date);
        }

        function getWeekEnd(dateStr) {
            return addDays(getWeekStart(dateStr), 6);
        }

        function getMonthStart(dateStr) {
            const date = parseLocalDate(dateStr);
            return formatLocalDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
        }

        function getMonthEnd(dateStr) {
            const date = parseLocalDate(dateStr);
            return formatLocalDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
        }

        function escapeHtml(value = '') {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function escapeJsArg(value = '') {
            return escapeHtml(JSON.stringify(String(value || '')));
        }

        function toSafeClassName(value = '', fallback = 'unknown') {
            const text = String(value || '').trim();
            if (/^[\p{L}\p{N}_-]+$/u.test(text)) return text;
            const fallbackText = String(fallback || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '') || 'unknown';
            return `${fallbackText}-${hashString(text || fallbackText)}`;
        }

        // Dynamic IDs can arrive from imported or synced JSON. Keep them as data, never executable code.
        window.escapeInlineJsArg = escapeJsArg;

        const TODO_URGENCY_META = {
            urgent: { label: '紧急', rank: 4 },
            high: { label: '高', rank: 3 },
            medium: { label: '中', rank: 2 },
            low: { label: '低', rank: 1 }
        };
        todosService = window.LifePlanTodosService.create({
            urgencyMeta: TODO_URGENCY_META,
            formatDate: value => formatDate(value),
            getTodayStr: () => getTodayStr(),
            getNowLocal: date => getLocalDateTimeStr(date),
            formatClockTime: date => formatClockTime(date),
            genId: () => genId()
        });
        recordsService = window.LifePlanRecordsService.create({
            ideaStatusOptions: IDEA_STATUS_OPTIONS,
            ideaUnprocessedStatuses: IDEA_UNPROCESSED_STATUSES,
            normalizeTagList: tags => normalizeTagList(tags),
            formatDate: value => formatDate(value),
            formatLocalDateKey: date => formatLocalDateKey(date)
        });
        aiService = window.LifePlanAiService.create({
            todoUrgencyMeta: TODO_URGENCY_META,
            getTodayStr: () => getTodayStr(),
            addDays: (date, days) => addDays(date, days),
            getNowLocal: date => getLocalDateTimeStr(date),
            fetchImpl: (...args) => fetch(...args)
        });

        function getTodoUrgencyMeta(todoOrUrgency) {
            return todosService.getTodoUrgencyMeta(todoOrUrgency);
        }

        function getTodoSortDate(todo) {
            return todosService.getTodoSortDate(todo);
        }

        function compareTodosForFocus(a, b) {
            return todosService.compareTodosForFocus(a, b);
        }

        function formatTodoDueDate(todo) {
            return todosService.formatTodoDueDate(todo);
        }

        function getTodoPlanLabel(todo) {
            return todosService.getTodoPlanLabel(todo);
        }

        function isTodoInDateRange(todo, start, end) {
            return todosService.isTodoInDateRange(todo, start, end);
        }

        function renderTodoUrgencyBadge(todo) {
            const meta = getTodoUrgencyMeta(todo);
            const urgency = todo?.urgency || 'medium';
            return `<span class="todo-urgency todo-urgency-${toSafeClassName(urgency, 'todo-urgency')}">${escapeHtml(meta.label)}</span>`;
        }

        function getRecordDateRangeLabel(record) {
            return recordsService.getRecordDateRangeLabel(record);
        }

        function parseRecordContentSections(content = '') {
            return recordsService.parseRecordContentSections(content);
        }

        function renderPreviewText(text = '') {
            return escapeHtml(text).replace(/\n/g, '<br>');
        }

        function renderRecordContentPreview(content = '') {
            const sections = parseRecordContentSections(content);
            if (sections.length === 0) {
                return '<div class="record-preview-empty">还没有内容</div>';
            }

            return sections.map(section => {
                const body = section.body.join('\n').trim();
                return `
                    <div class="record-preview-section">
                        <h4>${escapeHtml(section.title || '内容')}</h4>
                        <div class="record-preview-text">${body ? renderPreviewText(body) : '<span class="record-preview-placeholder">暂未填写</span>'}</div>
                    </div>
                `;
            }).join('');
        }

        const uniqueScopedRecordTypes = new Set(['日记', '日计划', '工作记录', '周复盘', '周计划', '月复盘', '月计划', '年复盘', '年度计划', '3年计划', '终身愿景']);

        function getSuggestedRangeForType(type, baseDate = new Date()) {
            return recordsService.getSuggestedRangeForType(type, baseDate);
        }

        function findExistingScopedRecord(type, startDate, endDate, excludeId = '') {
            if (!uniqueScopedRecordTypes.has(type)) return null;

            return data.records.find(record => {
                if (record.id === excludeId || record.type !== type) return false;
                if (type === '终身愿景') return true;
                return (record.startDate || '') === (startDate || '') && (record.endDate || '') === (endDate || '');
            }) || null;
        }

        function hasMeaningfulRecordInput() {
            const title = document.getElementById('record-title')?.value.trim() || '';
            const rawContent = document.getElementById('record-content')?.value || '';
            const hasTodos = tempTodos.length > 0;
            const hasTemplateContent = Object.values(currentTemplateFields).some(value => String(value || '').trim());
            const plainContent = currentStructuredTemplateId
                ? ''
                : rawContent.trim();

            return Boolean(title || hasTodos || hasTemplateContent || plainContent);
        }

        // 防抖函数
        function debounce(func, wait) {
            let timeout;
            const debounced = function() {
                clearTimeout(timeout);
                timeout = setTimeout(func, wait);
            };
            debounced.cancel = function() {
                clearTimeout(timeout);
            };
            return debounced;
        }

        // ================== 页面切换 ==================
        function switchPage(pageName, navEl) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById('page-' + pageName).classList.add('active');
            if (navEl) navEl.classList.add('active');

            if (pageName === 'dashboard') renderDashboard();
            if (pageName === 'records') renderAllRecords();
            if (pageName === 'ideas') renderIdeaPool();
            if (pageName === 'materials') renderMaterialsPage();
            if (pageName === 'tags') renderTagCenter();
            if (pageName === 'search') renderGlobalSearch();
            if (pageName === 'todos') renderTodoTable();
            if (pageName === 'habits') renderHabitPage();
            if (pageName === 'fitness') {
                if (typeof renderFitnessPage === 'function') renderFitnessPage();
            }
            if (pageName === 'goals') renderGoalList();
            if (pageName === 'wheel') renderWheelPage();
        }

        function refreshKnowledgeViews() {
            renderIdeaPool();
            renderMaterialsPage();
            renderTagCenter();
            renderGlobalSearch();
        }

        function getNavItemByPage(pageName) {
            return Array.from(document.querySelectorAll('.nav-item'))
                .find(item => (item.getAttribute('onclick') || '').includes(`'${pageName}'`));
        }

        function navigateToPage(pageName) {
            switchPage(pageName, getNavItemByPage(pageName));
        }

        // ================== 首页仪表盘 ==================
        function renderTodayDate() {
            document.getElementById('today-date').textContent = formatDate(getTodayStr());
            document.getElementById('hero-date').textContent = formatDate(getTodayStr());
        }

        function renderDashboard() {
            renderDashboardSummary();
            renderDashboardCommandCenter();
            renderTodayTodos();
            renderFloatingTodos(currentFloatingTodoMode);
            renderTodayHabits();
            renderActivePeriods();
            renderTimeline();
        }

        function renderDashboardSummary() {
            const today = getTodayStr();
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() || 7) - 1));
            const weekStartStr = formatLocalDateKey(weekStart);
            const todayTodos = data.todos.filter(t => isTodoRelevantToday(t));
            const todayTodoDone = todayTodos.filter(t => t.done).length;
            const dueHabits = data.habits.filter(h => isHabitDueToday(h));
            const doneHabits = dueHabits.filter(h => getCheckinCount(h.id, today) > 0).length;
            const activeGoals = data.goals.filter(g => g.status === '进行中').length;
            const weekRecords = data.records.filter(r => r.startDate >= weekStartStr).length;
            const nextTodo = data.todos
                .filter(t => !t.done)
                .sort(compareTodosForFocus)[0];

            const fitnessSnippet = typeof getFitnessDashboardSnippet === 'function'
                ? getFitnessDashboardSnippet()
                : { workoutText: '0', streakText: '0' };

            document.getElementById('summary-todos').textContent = `${todayTodoDone}/${todayTodos.length}`;
            document.getElementById('summary-habits').textContent = `${doneHabits}/${dueHabits.length}`;
            document.getElementById('summary-goals').textContent = activeGoals;
            document.getElementById('summary-records').textContent = weekRecords;
            document.getElementById('hero-title').textContent = nextTodo ? `今天先处理：${nextTodo.text}` : '今天先把最重要的事推进一点';
            document.getElementById('hero-meta').innerHTML = [
                `待办 ${todayTodoDone}/${todayTodos.length}`,
                `习惯 ${doneHabits}/${dueHabits.length}`,
                `进行中目标 ${activeGoals}`,
                `本周记录 ${weekRecords}`,
                `近30天训练 ${fitnessSnippet.workoutText}`,
                `连续训练 ${fitnessSnippet.streakText} 天`
            ].map(text => `<span>${escapeHtml(text)}</span>`).join('');
        }

        function getDashboardMaterialPicks() {
            return sampleRandomItems(data.materials, 2);
        }

        function renderGoalFocusList() {
            const goals = [...data.goals]
                .filter(goal => goal.status === '进行中')
                .sort((a, b) => Number(b.progress || 0) - Number(a.progress || 0))
                .slice(0, 3);
            if (!goals.length) return '<div class="empty-state compact-empty">暂无进行中的目标</div>';
            return goals.map(goal => `
                <div class="command-row" onclick="openGoalDetail(${escapeJsArg(goal.id)})">
                    <span>${escapeHtml(goal.name || '未命名目标')}</span>
                    <strong>${Number(goal.progress || 0)}%</strong>
                </div>
            `).join('');
        }

        function renderDashboardCommandCenter() {
            const container = document.getElementById('dashboard-command-center');
            if (!container) return;
            const ideas = data.records.filter(record => record.type === '灵感碎片');
            const unprocessedIdeas = ideas.filter(isIdeaUnprocessed);
            const needsConclusionIdeas = ideas.filter(ideaNeedsConclusion);
            const today = getTodayStr();
            const urgentTodos = data.todos
                .filter(todo => !todo.done && (isTodoOverdue(todo, today) || ['urgent', 'high'].includes(todo.urgency)))
                .sort(compareTodosForFocus)
                .slice(0, 4);
            const materialPicks = getDashboardMaterialPicks();
            const fitnessSnippet = typeof getFitnessDashboardSnippet === 'function'
                ? getFitnessDashboardSnippet()
                : {
                    weightText: '—',
                    workoutText: '0',
                    planText: '0',
                    streakText: '0',
                    latestText: '暂无训练记录',
                    suggestion: null
                };
            const fitnessAction = fitnessSnippet.suggestion
                ? `<button class="btn btn-secondary todo-mini-btn" onclick="startLiveWorkoutFromPlan(${escapeJsArg(fitnessSnippet.suggestion.planId)})">按计划开练</button>`
                : `<button class="btn btn-secondary todo-mini-btn" onclick="navigateToPage('fitness')">去健身页</button>`;

            container.innerHTML = `
                <div class="command-card command-card-ideas">
                    <div class="command-card-head">
                        <div>
                            <div class="section-title">今日指挥中心</div>
                            <p>先看哪里卡住，再决定下一步。</p>
                        </div>
                        <button class="btn btn-secondary todo-mini-btn" onclick="navigateToPage('tags')">标签中心</button>
                    </div>
                    <div class="command-metric-grid">
                        <button onclick="jumpToIdeas('unprocessed')" class="command-metric">
                            <strong>${unprocessedIdeas.length}</strong>
                            <span>未处理灵感</span>
                        </button>
                        <button onclick="jumpToIdeas('needsConclusion')" class="command-metric">
                            <strong>${needsConclusionIdeas.length}</strong>
                            <span>待写结论</span>
                        </button>
                        <button onclick="navigateToPage('todos')" class="command-metric">
                            <strong>${urgentTodos.length}</strong>
                            <span>高压待办</span>
                        </button>
                    </div>
                    ${urgentTodos.length ? `
                        <div class="command-list">
                            ${urgentTodos.map(todo => `
                                <div class="command-row" onclick="openTodoDetail(${escapeJsArg(todo.id)})">
                                    <span>${escapeHtml(todo.text || '未命名待办')}</span>
                                    ${renderTodoUrgencyBadge(todo)}
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="empty-state compact-empty">暂时没有超期或高优先级待办</div>'}
                </div>
                <div class="command-card">
                    <div class="command-card-head">
                        <div>
                            <div class="section-title">运动健身</div>
                            <p>把身材变化和训练节奏放到今天的视野里。</p>
                        </div>
                        ${fitnessAction}
                    </div>
                    <div class="command-metric-grid">
                        <button onclick="navigateToPage('fitness')" class="command-metric">
                            <strong>${escapeHtml(fitnessSnippet.weightText)}</strong>
                            <span>当前体重</span>
                        </button>
                        <button onclick="navigateToPage('fitness')" class="command-metric">
                            <strong>${escapeHtml(fitnessSnippet.workoutText)}</strong>
                            <span>近30天训练</span>
                        </button>
                        <button onclick="navigateToPage('fitness')" class="command-metric">
                            <strong>${escapeHtml(fitnessSnippet.streakText)}</strong>
                            <span>连续训练天</span>
                        </button>
                    </div>
                    <div class="command-list">
                        <div class="command-row" onclick="navigateToPage('fitness')">
                            <span>${escapeHtml(fitnessSnippet.latestText)}</span>
                            <strong>计划 ${escapeHtml(fitnessSnippet.planText)}</strong>
                        </div>
                        ${fitnessSnippet.suggestion ? `
                            <div class="command-row" onclick="startLiveWorkoutFromPlan(${escapeJsArg(fitnessSnippet.suggestion.planId)})">
                                <span>今日建议：${escapeHtml(fitnessSnippet.suggestion.label)}</span>
                                <strong>开练</strong>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="command-card">
                    <div class="command-card-head">
                        <div>
                            <div class="section-title">随机复习素材</div>
                            <p>从素材库随手捞两条，给今天一点燃料。</p>
                        </div>
                        <button class="btn btn-secondary todo-mini-btn" onclick="navigateToPage('materials')">去素材库</button>
                    </div>
                    <div class="command-materials">
                        ${materialPicks.length ? materialPicks.map(material => renderMaterialCard(material, true)).join('') : '<div class="empty-state compact-empty">素材库还没有内容</div>'}
                    </div>
                </div>
                <div class="command-card">
                    <div class="command-card-head">
                        <div>
                            <div class="section-title">目标进度</div>
                            <p>只看进行中的目标，避免长期目标隐身。</p>
                        </div>
                        <button class="btn btn-secondary todo-mini-btn" onclick="navigateToPage('goals')">看目标</button>
                    </div>
                    <div class="command-list">${renderGoalFocusList()}</div>
                </div>
            `;
        }

        // 今日待办
        function isTodoPlannedOnDate(todo, dateStr) {
            return !!(todo.planStartDate && todo.planEndDate && todo.planStartDate <= dateStr && todo.planEndDate >= dateStr);
        }

        function hasTodoSessionOnDate(todo, dateStr) {
            return todosService.hasTodoSessionOnDate(todo, dateStr);
        }

        function isTodoRelevantToday(todo) {
            const today = getTodayStr();
            return isTodoOverdue(todo, today) || todo.dueDate === today || isTodoPlannedOnDate(todo, today) || hasTodoSessionOnDate(todo, today);
        }

        function isTodoOverdue(todo, today = getTodayStr()) {
            return !!(!todo?.done && todo?.dueDate && todo.dueDate < today);
        }

        function getTodoOverdueDays(todo, today = getTodayStr()) {
            if (!isTodoOverdue(todo, today)) return 0;
            const diff = parseLocalDate(today) - parseLocalDate(todo.dueDate);
            return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
        }

        function getTodayTodoReason(todo) {
            const today = getTodayStr();
            const reasons = [];
            if (isTodoOverdue(todo, today)) reasons.push(`已超期 ${getTodoOverdueDays(todo, today)} 天`);
            if (isTodoPlannedOnDate(todo, today)) reasons.push('计划中');
            if (todo.dueDate === today) reasons.push('今天截止');
            if (hasTodoSessionOnDate(todo, today)) reasons.push('今天已记录');
            return reasons.join(' · ') || '今日关注';
        }

        function renderTodayTodos() {
            const todayTodos = data.todos
                .filter(t => isTodoRelevantToday(t) && !t.done)
                .sort(compareTodosForFocus)
                .slice(0, 8);
            const container = document.getElementById('today-todos');
            
            if (todayTodos.length === 0) {
                container.innerHTML = '<div style="color:#999; font-size:13px; padding:10px 0;">今日暂无待办</div>';
                return;
            }

            container.innerHTML = `
                <ul class="todo-list">
                    ${todayTodos.map(t => `
                        <li class="todo-item">
                            <input type="checkbox" onchange="toggleTodo(${escapeJsArg(t.id)}); renderDashboard();">
                            <span class="todo-text" onclick="openTodoDetail(${escapeJsArg(t.id)})">
                                ${escapeHtml(t.text)}
                                <small>${escapeHtml(getTodayTodoReason(t))}</small>
                            </span>
                            ${renderTodoUrgencyBadge(t)}
                            <span class="todo-actions">
                                <button class="btn btn-secondary todo-mini-btn" onclick="addQuickTodoSession(${escapeJsArg(t.id)})">执行一次</button>
                            </span>
                        </li>
                    `).join('')}
                </ul>
            `;
        }

        let currentFloatingTodoMode = 'random';

        function getTodoCreatedValue(todo) {
            return todo.createdAt || todo.updatedAt || todo.id || '';
        }

        function renderFloatingTodos(mode = currentFloatingTodoMode) {
            currentFloatingTodoMode = mode || 'random';
            const container = document.getElementById('floating-todos');
            if (!container) return;
            document.querySelectorAll('.todo-pool-mode').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === currentFloatingTodoMode);
            });

            const candidates = data.todos.filter(t => (
                !t.done &&
                !t.dueDate &&
                !t.planStartDate &&
                !t.planEndDate
            ));

            if (candidates.length === 0) {
                container.innerHTML = '<div style="color:#999; font-size:13px; padding:10px 0;">暂无无截止待办</div>';
                return;
            }

            let picked = [...candidates];
            if (currentFloatingTodoMode === 'newest') {
                picked.sort((a, b) => getTodoCreatedValue(b).localeCompare(getTodoCreatedValue(a)));
            } else if (currentFloatingTodoMode === 'oldest') {
                picked.sort((a, b) => getTodoCreatedValue(a).localeCompare(getTodoCreatedValue(b)));
            } else {
                picked = sampleRandomItems(picked, 5);
            }
            if (currentFloatingTodoMode !== 'random') picked = picked.slice(0, 5);

            container.innerHTML = `
                <ul class="todo-list">
                    ${picked.map(t => `
                        <li class="todo-item">
                            <input type="checkbox" onchange="toggleTodo(${escapeJsArg(t.id)}); renderDashboard();">
                            <span class="todo-text" onclick="openTodoDetail(${escapeJsArg(t.id)})">
                                ${escapeHtml(t.text)}
                                <small>无截止 · 可转入今天</small>
                            </span>
                            ${renderTodoUrgencyBadge(t)}
                            <span class="todo-actions">
                                <button class="btn btn-secondary todo-mini-btn" onclick="planTodoForToday(${escapeJsArg(t.id)})">今天做</button>
                                <button class="btn btn-secondary todo-mini-btn" onclick="addQuickTodoSession(${escapeJsArg(t.id)})">执行一次</button>
                            </span>
                        </li>
                    `).join('')}
                </ul>
                ${candidates.length > picked.length ? `<div class="todo-pool-hint">还有 ${candidates.length - picked.length} 条无截止待办没展示</div>` : ''}
            `;
        }

        function planTodoForToday(todoId) {
            const todo = data.todos.find(t => t.id === todoId);
            if (!todo) return;
            const today = getTodayStr();
            todo.planStartDate = today;
            todo.planEndDate = today;
            todo.updatedAt = getLocalDateTimeStr();
            saveData();
            renderDashboard();
            renderTodoTable();
            renderAllRecords();
        }

        function addQuickTodoSession(todoId) {
            if (!todoId) {
                alert('请先保存待办，再记录执行时间');
                return;
            }
            const todo = data.todos.find(t => t.id === todoId);
            if (!todo) return;

            const now = new Date();
            const today = getTodayStr();
            todo.sessions = Array.isArray(todo.sessions) ? todo.sessions : [];
            if (hasTodoSessionOnDate(todo, today)) {
                alert('这个待办今天已经记录过一次执行了');
                return;
            }
            todo.sessions.push({
                id: genId(),
                date: today,
                startTime: formatClockTime(now),
                endTime: '',
                note: '快捷执行',
                createdAt: getLocalDateTimeStr(now)
            });
            todo.updatedAt = getLocalDateTimeStr(now);
            saveData();

            if (currentTodoId === todoId) {
                tempTodoSessions = JSON.parse(JSON.stringify(todo.sessions));
                renderTodoDetailView();
                renderTodoSessions();
                renderTodoRecords();
            }
            renderDashboard();
            renderTodoTable();
            renderAllRecords();
        }

        // 今日习惯快捷打卡
        function renderTodayHabits() {
            const today = getTodayStr();
            const container = document.getElementById('today-habits');
            const todayHabits = data.habits.filter(h => isHabitDueToday(h));
            
            if (todayHabits.length === 0) {
                container.innerHTML = '<div class="empty-state" style="padding:18px 14px;">今日暂无安排的习惯</div>';
                return;
            }

            container.innerHTML = `<div class="habit-quick-list">${todayHabits.map(habit => {
                const targetCount = getHabitTargetCount(habit);
                const doneCount = getCheckinCount(habit.id, today);
                const latestCheckin = getLatestHabitCheckin(habit.id, today);
                const latestTime = latestCheckin ? getCheckinClockTime(latestCheckin) : '';
                const latestNote = getCheckinNoteSummary(latestCheckin?.note, 22);
                const statusClass = doneCount === 0 ? 'is-pending' : (doneCount >= targetCount ? 'is-done' : 'is-active');
                const statusText = doneCount === 0
                    ? '待开始'
                    : (doneCount >= targetCount ? '今日达标' : `进行中 ${doneCount}/${targetCount}`);
                const rewardMeta = habit.randomReward
                    ? (
                        Math.max(0, parseInt(habit.rewardMin ?? habit.rewardPoints ?? 0, 10) || 0) > 0 ||
                        Math.max(0, parseInt(habit.rewardMax ?? habit.rewardPoints ?? 0, 10) || 0) > 0
                    )
                        ? {
                            text: `+${habit.rewardMin ?? habit.rewardPoints ?? 0}-${habit.rewardMax ?? habit.rewardPoints ?? 0} ${normalizeHabitCurrency(habit.rewardCurrency)}`,
                            className: 'is-points'
                        }
                        : null
                    : (Math.max(0, parseInt(habit.rewardPoints ?? 0, 10) || 0) > 0
                        ? { text: `+${habit.rewardPoints} ${normalizeHabitCurrency(habit.rewardCurrency)}`, className: 'is-points' }
                        : null);
                const infoParts = [
                    { text: getHabitRuleText(habit) },
                    { text: `${doneCount}/${targetCount}` },
                    { text: latestTime || '未记录' },
                    rewardMeta,
                    habit.penaltyPoints > 0 ? { text: `漏打 -${habit.penaltyPoints}`, className: 'is-penalty' } : null
                ].filter(Boolean);
                const primaryActionText = targetCount > 1 && doneCount > 0 ? '再记一次' : '打卡';
                const actionButtons = doneCount === 0
                    ? `
                        <button class="habit-quick-btn primary" onclick="quickHabitCheckin(${escapeJsArg(habit.id)})">${primaryActionText}</button>
                        <button class="habit-quick-btn secondary" onclick="quickHabitCheckinWithNote(${escapeJsArg(habit.id)})">备注</button>
                    `
                    : targetCount === 1
                        ? `
                            <button class="habit-quick-btn secondary" onclick="quickHabitCheckin(${escapeJsArg(habit.id)})">备注</button>
                            <button class="habit-quick-btn ghost" onclick="quickUndoHabitCheckin(${escapeJsArg(habit.id)})">撤销</button>
                        `
                        : `
                            <button class="habit-quick-btn primary" onclick="quickHabitCheckin(${escapeJsArg(habit.id)})">打卡</button>
                            <button class="habit-quick-btn secondary" onclick="${latestCheckin ? `editLatestHabitNote(${escapeJsArg(habit.id)})` : `quickHabitCheckinWithNote(${escapeJsArg(habit.id)})`}">备注</button>
                            <button class="habit-quick-btn ghost" onclick="quickDecreaseHabitCheckin(${escapeJsArg(habit.id)})">-1</button>
                        `;

                return `
                    <article class="habit-quick-card compact ${doneCount > 0 ? 'done' : ''} ${targetCount > 1 ? 'multi' : ''}">
                        <div class="habit-quick-head">
                            <div class="habit-quick-main">
                                <div class="habit-quick-title-row">
                                    <div class="habit-quick-title">${escapeHtml(habit.name)}</div>
                                    <span class="habit-quick-tag">${escapeHtml(habit.tag || '习惯')}</span>
                                    <span class="habit-quick-status ${statusClass}">${escapeHtml(statusText)}</span>
                                </div>
                                <div class="habit-quick-meta">${infoParts.map(part => `<span class="${part.className || ''}">${escapeHtml(part.text)}</span>`).join('')}</div>
                                ${latestNote ? `<div class="habit-quick-note-inline">备注：${escapeHtml(latestNote)}</div>` : ''}
                            </div>
                            <div class="habit-quick-actions compact">
                                ${actionButtons}
                            </div>
                        </div>
                    </article>
                `;
            }).join('')}</div>`;
        }

        // 判断习惯今日是否应打卡
        function isHabitDueToday(habit) {
            return isHabitDueOnDate(habit, getTodayStr());
        }

        // 进行中的周期记录
        function renderActivePeriods() {
            const today = getTodayStr();
            const periodTypes = ['周复盘','月复盘','年复盘','周计划','月计划','年度计划','3年计划','终身愿景'];
            const activePeriods = data.records.filter(r => {
                const isPeriodType = periodTypes.includes(r.type);
                const isActive = r.endDate >= today || !r.endDate;
                return isPeriodType && isActive;
            }).sort((a,b) => (a.endDate||'9999-12-31').localeCompare(b.endDate||'9999-12-31'));

            const container = document.getElementById('active-periods');
            if (activePeriods.length === 0) {
                container.innerHTML = '<div style="color:#999; font-size:13px; text-align:center; padding:15px;">暂无进行中的周期记录</div>';
                return;
            }

            container.innerHTML = activePeriods.map(r => {
                const todoCount = data.todos.filter(t => r.todoIds?.includes(t.id)).length;
                const doneCount = data.todos.filter(t => r.todoIds?.includes(t.id) && t.done).length;
                const progress = todoCount > 0 ? Math.round(doneCount / todoCount * 100) : 0;
                const typeClass = toSafeClassName(r.type, 'record-type');
                return `
                    <div class="period-item" onclick="openRecordPreview(${escapeJsArg(r.id)})">
                        <div class="period-info">
                            <h4><span class="item-type type-${typeClass}" style="margin-right:8px;">${escapeHtml(r.type)}</span>${escapeHtml(r.title || '无标题')}</h4>
                            <p>${formatDate(r.startDate)} ~ ${formatDate(r.endDate)} · 待办 ${doneCount}/${todoCount}</p>
                        </div>
                        <div class="progress-bar" style="width:120px;">
                            <div class="progress-fill" style="width:${progress}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 时间轴渲染
        function getDayOrder() {
            return document.getElementById('record-day-order')?.value || 'desc';
        }

        function sortRecordsInDay(records) {
            const order = getDayOrder();
            return [...records].sort((a,b) => {
                const result = getRecordSortValue(a).localeCompare(getRecordSortValue(b));
                return order === 'asc' ? result : -result;
            });
        }

        function renderIdeaBadges(record) {
            if (record?.type !== '灵感碎片') return '';
            const tags = getIdeaTags(record);
            const status = getIdeaStatus(record);
            return `
                <div class="idea-badge-row">
                    <span class="idea-status-badge status-${toSafeClassName(status, 'idea-status')}">${escapeHtml(status)}</span>
                    ${tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}
                </div>
            `;
        }

        function getIdeaMetaParts(record) {
            if (record?.type !== '灵感碎片') return [];
            const todo = getIdeaTodo(record);
            return [
                `状态 ${getIdeaStatus(record)}`,
                record.ideaNextAction ? `下一步：${record.ideaNextAction}` : '',
                todo ? `关联待办：${todo.text}` : '',
                record.ideaConclusion ? '已有结论' : ''
            ].filter(Boolean);
        }

        function renderRecordCard(record, dayTypes = ['日记', '日计划', '灵感碎片']) {
            const todoCount = data.todos.filter(t => record.todoIds?.includes(t.id)).length;
            const doneCount = data.todos.filter(t => record.todoIds?.includes(t.id) && t.done).length;
            const isPeriod = !dayTypes.includes(record.type);
            const ideaMeta = getIdeaMetaParts(record);
            const typeClass = toSafeClassName(record.type, 'record-type');
            return `
                <div class="record-row">
                    <div class="record-time">${getRecordTime(record)}</div>
                    <div class="timeline-item type-${typeClass}" onclick="openRecordPreview(${escapeJsArg(record.id)})">
                        <span class="item-type type-${typeClass}">${escapeHtml(record.type)}</span>
                        <span class="item-title">${escapeHtml(record.title || '无标题')}</span>
                        ${renderIdeaBadges(record)}
                        <div class="item-meta">
                            ${isPeriod ? `<span>${formatDate(record.startDate)} ~ ${formatDate(record.endDate)}</span>` : ''}
                            <span>待办 ${doneCount}/${todoCount}</span>
                            ${ideaMeta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
                        </div>
                        ${record.content ? `<div class="item-preview">${escapeHtml(record.content.replace(/\n/g, ' '))}</div>` : ''}
                    </div>
                </div>
            `;
        }

        function renderScheduleCard(item) {
            const label = item.filterType === '待办' ? '待办' : (item.sourceType === 'habit' ? '习惯' : item.type);
            const preview = item.preview ? `<div class="item-preview">${escapeHtml(item.preview)}</div>` : '';
            const metaParts = [item.meta, item.filterType === '待办' && item.done ? '已完成' : '', item.sourceType === 'habit' ? item.timeLabel : ''].filter(Boolean);
            const toneStyle = `--event-bg:${item.tone.bg}; --event-border:${item.tone.border}; --event-ink:${item.tone.ink};`;
            const labelClass = toSafeClassName(label, 'schedule-type');
            return `
                <div class="record-row">
                    <div class="record-time">${item.allDay ? item.timeLabel : formatMinutesLabel(item.startMinutes)}</div>
                    <div class="timeline-item type-${labelClass}" style="${toneStyle}" onclick="${item.click}">
                        <span class="item-type type-${labelClass}">${escapeHtml(label)}</span>
                        <span class="item-title">${escapeHtml(item.title || '未命名')}</span>
                        ${metaParts.length ? `<div class="item-meta">${metaParts.map(part => `<span>${escapeHtml(part)}</span>`).join('')}</div>` : ''}
                        ${preview}
                    </div>
                </div>
            `;
        }

        function focusHabitFromSchedule(habitId) {
            currentHabitId = habitId;
            currentHabitView = 'analysis';
            const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent.includes('习惯打卡'));
            switchPage('habits', navEl);
        }

        function renderTimeline() {
            const container = document.getElementById('timeline');
            const { startDate, endDate } = getDashboardTimelineRange();
            const items = buildScheduleItemsForRange(startDate, endDate, {
                includeRecords: true,
                includeTodos: true,
                includeHabits: true,
                includeTodoPlans: false,
                includeTodoDue: false,
                includeTodoSessions: true
            });
            const groups = {};
            items.forEach(item => {
                if (!groups[item.date]) groups[item.date] = [];
                groups[item.date].push(item);
            });

            const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

            if (sortedDates.length === 0) {
                container.innerHTML = '<div class="empty-state">当前范围暂无记录，换个范围或新建第一条吧</div>';
                return;
            }

            container.innerHTML = sortedDates.map(date => `
                <div class="timeline-group">
                    <div class="timeline-date">${formatDate(date)}</div>
                    ${sortScheduleItemsInDay(groups[date]).map(item => renderScheduleCard(item)).join('')}
                </div>
            `).join('');
        }

        // ================== 记录管理 ==================
        function openTypeSelect() {
            document.getElementById('type-select-modal').classList.add('active');
        }

        function closeTypeSelect() {
            document.getElementById('type-select-modal').classList.remove('active');
        }

        function createRecord(type) {
            closeTypeSelect();
            const range = getSuggestedRangeForType(type);
            const existingRecord = findExistingScopedRecord(type, range.start, range.end);
            if (existingRecord) {
                openRecordModal(existingRecord.id);
                document.getElementById('record-modal-title').textContent = `继续编辑${type}`;
                document.getElementById('save-status').textContent = '这个周期已经有一条了，已为你打开继续编辑';
                return;
            }

            currentRecordId = null;
            tempTodos = [];
            resetStructuredTemplateEditor();
            isRecordDirty = false;
            
            document.getElementById('record-modal-title').textContent = '新建' + type;
            document.getElementById('record-type').value = type;
            document.getElementById('record-title').value = '';
            document.getElementById('record-content').value = '';
            document.getElementById('record-time').value = new Date().toTimeString().slice(0, 5);
            document.getElementById('record-end-time').value = '';
            document.getElementById('delete-record-btn').style.display = 'none';
            setIdeaFormValues();
            
            autoFillDateRange();
            applyDiaryDefaultTitle(true);
            refreshTemplateSelect(type);
            const defaultTemplate = builtInTemplates.find(t => t.type === type && t.fields);
            if (defaultTemplate) {
                currentStructuredTemplateId = defaultTemplate.id;
                currentTemplateFields = {};
                document.getElementById('template-select').value = `builtin:${defaultTemplate.id}`;
                renderStructuredTemplateEditor(defaultTemplate, currentTemplateFields);
                document.getElementById('record-content').value = composeTemplateContent(defaultTemplate, currentTemplateFields);
            }
            renderRecordTodos();
            updateIdeaFieldsVisibility();
            
            document.getElementById('record-modal').classList.add('active');
            document.getElementById('save-status').textContent = '';
        }

        // 根据类型自动填充时间跨度
        function autoFillDateRange() {
            const type = document.getElementById('record-type').value;
            const { start, end } = getSuggestedRangeForType(type);

            document.getElementById('record-start-date').value = start;
            document.getElementById('record-end-date').value = end;
            refreshTemplateSelect(type);
            const currentTemplate = getBuiltInTemplate(currentStructuredTemplateId);
            if (currentTemplate && currentTemplate.type !== type) resetStructuredTemplateEditor();
        }

        function handleRecordDateChange() {
            applyDiaryDefaultTitle(false);
            scheduleRecordAutoSave();
        }

        function buildPreviewRecordFromForm() {
            return {
                id: currentRecordId,
                ...getRecordFormData(),
                createdAt: data.records.find(r => r.id === currentRecordId)?.createdAt || getLocalDateTimeStr(),
                updatedAt: getLocalDateTimeStr()
            };
        }

        function renderRecordPreview(record, todos = [], fromEditor = false) {
            const title = record.title || record.type || '未命名记录';
            const doneCount = todos.filter(t => t.done).length;
            const updatedLabel = formatStoredDateTime(record.updatedAt || record.createdAt);
            const meta = [
                getRecordDateRangeLabel(record),
                `时间 ${getRecordTime(record)}`,
                `待办 ${doneCount}/${todos.length}`
            ];
            meta.push(...getIdeaMetaParts(record));
            if (updatedLabel) meta.push(`更新于 ${updatedLabel}`);

            return `
                <div class="record-preview-shell">
                    <div class="record-preview-top">
                        <span class="item-type type-${toSafeClassName(record.type, 'record-type')}">${escapeHtml(record.type)}</span>
                        <div class="record-preview-title">${escapeHtml(title)}</div>
                        <div class="record-preview-meta">
                            ${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
                            ${fromEditor ? '<span>当前预览，尚未保存</span>' : ''}
                        </div>
                    </div>
                    <div class="record-preview-content">
                        <div class="record-preview-heading">内容</div>
                        ${renderRecordContentPreview(record.content || '')}
                    </div>
                    ${record.type === '灵感碎片' ? `
                        <div class="record-preview-content">
                            <div class="record-preview-heading">灵感推进</div>
                            ${renderIdeaBadges(record)}
                            <div class="idea-detail-grid">
                                <div><strong>下一步</strong><span>${escapeHtml(record.ideaNextAction || '未设置')}</span></div>
                                <div><strong>关联待办</strong><span>${escapeHtml(getIdeaTodo(record)?.text || '未关联')}</span></div>
                                <div class="wide"><strong>结果结论</strong><span>${escapeHtml(record.ideaConclusion || '还没有结论')}</span></div>
                            </div>
                            ${fromEditor ? '' : `
                                <div class="idea-card-actions">
                                    <button class="btn btn-secondary todo-mini-btn" onclick="convertIdeaToTodo(${escapeJsArg(record.id)})">${getIdeaTodo(record) ? '打开关联待办' : '转成待办'}</button>
                                </div>
                            `}
                        </div>
                    ` : ''}
                    ${todos.length ? `
                        <div class="record-preview-todos">
                            <div class="record-preview-heading">关联待办</div>
                            ${todos.map(todo => `
                                <div class="record-preview-todo-item ${todo.done ? 'done' : ''}">
                                    <span class="record-preview-dot"></span>
                                    <span>${escapeHtml(todo.text || '未命名待办')}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="record-preview-actions">
                        ${fromEditor
                            ? '<button class="btn btn-secondary" onclick="backToEditFromPreview()">返回继续编辑</button>'
                            : `
                                ${record.type === '日记' ? `<button class="btn btn-secondary" onclick="openAiAssistant('diaryReview',${escapeJsArg(record.id)})">AI 分析日记</button>` : ''}
                                <button class="btn btn-secondary" onclick="editRecordFromPreview()">编辑</button>
                            `}
                    </div>
                </div>
            `;
        }

        function openRecordPreview(recordId) {
            const record = data.records.find(r => r.id === recordId);
            if (!record) return;

            currentPreviewRecordId = recordId;
            currentPreviewDraft = null;
            currentPreviewFromEditor = false;
            const todos = data.todos.filter(t => record.todoIds?.includes(t.id));
            document.getElementById('record-preview-body').innerHTML = renderRecordPreview(record, todos, false);
            document.getElementById('record-preview-modal').classList.add('active');
        }

        function previewCurrentRecord() {
            if (autoSaveRecord.cancel) autoSaveRecord.cancel();
            const draft = buildPreviewRecordFromForm();
            currentPreviewRecordId = currentRecordId;
            currentPreviewDraft = draft;
            currentPreviewFromEditor = true;
            document.getElementById('record-modal').classList.remove('active');
            document.getElementById('record-preview-body').innerHTML = renderRecordPreview(draft, tempTodos, true);
            document.getElementById('record-preview-modal').classList.add('active');
        }

        function backToEditFromPreview() {
            closeRecordPreview();
        }

        function editRecordFromPreview() {
            const recordId = currentPreviewRecordId;
            closeRecordPreview();
            if (recordId) openRecordModal(recordId);
        }

        function openRecordModal(recordId) {
            currentRecordId = recordId;
            const record = data.records.find(r => r.id === recordId);
            if (!record) return;

            tempTodos = data.todos.filter(t => record.todoIds?.includes(t.id));
            
            document.getElementById('record-modal-title').textContent = '编辑记录';
            document.getElementById('record-type').value = record.type;
            document.getElementById('record-title').value = record.title || '';
            document.getElementById('record-start-date').value = record.startDate || '';
            document.getElementById('record-end-date').value = record.endDate || '';
            document.getElementById('record-time').value = record.recordTime || '';
            document.getElementById('record-end-time').value = record.recordEndTime || '';
            document.getElementById('record-content').value = record.content || '';
            document.getElementById('delete-record-btn').style.display = 'inline-block';
            setIdeaFormValues(record);
            
            refreshTemplateSelect(record.type);
            currentStructuredTemplateId = record.templateId || '';
            const template = getBuiltInTemplate(currentStructuredTemplateId);
            if (template) {
                currentTemplateFields = parseTemplateContent(template, record.content || '');
                document.getElementById('template-select').value = `builtin:${template.id}`;
                renderStructuredTemplateEditor(template, currentTemplateFields);
            } else {
                currentTemplateFields = {};
                resetStructuredTemplateEditor();
            }
            renderRecordTodos();
            updateIdeaFieldsVisibility();
            
            document.getElementById('record-modal').classList.add('active');
            document.getElementById('save-status').textContent = '';
            isRecordDirty = false;
        }

        function closeRecordModal() {
            if (autoSaveRecord.cancel) autoSaveRecord.cancel();
            const didSave = isRecordDirty ? persistCurrentRecord(false) : false;
            document.getElementById('record-modal').classList.remove('active');
            currentRecordId = null;
            tempTodos = [];
            isRecordDirty = false;
            clearTimeout(autoSaveTimer);
            if (didSave) {
                renderDashboard();
                renderAllRecords();
                refreshKnowledgeViews();
            }
        }

        function closeRecordPreview() {
            const returnToEditor = currentPreviewFromEditor;
            document.getElementById('record-preview-modal').classList.remove('active');
            currentPreviewRecordId = null;
            currentPreviewDraft = null;
            currentPreviewFromEditor = false;
            if (returnToEditor) {
                document.getElementById('record-modal').classList.add('active');
            }
        }

        function renderRecordTodos() {
            const container = document.getElementById('record-todos');
            container.innerHTML = tempTodos.map((t, i) => `
                <li class="todo-item ${t.done ? 'done' : ''}">
                    <input type="checkbox" ${t.done ? 'checked' : ''} 
                        onchange="tempTodos[${i}].done = !tempTodos[${i}].done; renderRecordTodos(); scheduleRecordAutoSave();">
                    <span class="todo-text">${escapeHtml(t.text)}</span>
                    <button class="btn btn-secondary" style="padding:2px 8px; font-size:12px;" 
                        onclick="tempTodos.splice(${i},1); renderRecordTodos(); scheduleRecordAutoSave();">删除</button>
                </li>
            `).join('');
        }

        function addRecordTodo() {
            const input = document.getElementById('new-todo-input');
            const text = input.value.trim();
            if (!text) return;
            
            tempTodos.push({ 
                id: genId(), 
                text: text, 
                done: false, 
                group: '其他',
                dueDate: document.getElementById('record-end-date').value || getTodayStr(),
                urgency: 'medium',
                isExclusive: true,
                subTodos: []
            });
            input.value = '';
            renderRecordTodos();
            scheduleRecordAutoSave();
        }

        function renderIdeaTodoOptions(selectedId = '') {
            const select = document.getElementById('idea-todo-id');
            if (!select) return;
            const openTodos = data.todos
                .filter(todo => !todo.done || todo.id === selectedId)
                .sort(compareTodosForFocus);
            select.innerHTML = '<option value="">不关联</option>' + openTodos.map(todo => `
                <option value="${escapeHtml(todo.id)}" ${todo.id === selectedId ? 'selected' : ''}>${escapeHtml(todo.text || '未命名待办')}</option>
            `).join('');
        }

        function setIdeaFormValues(record = {}) {
            const statusEl = document.getElementById('idea-status');
            if (!statusEl) return;
            statusEl.value = getIdeaStatus(record);
            document.getElementById('idea-tags').value = tagsToInput(record.ideaTags || []);
            document.getElementById('idea-next-action').value = record.ideaNextAction || '';
            document.getElementById('idea-conclusion').value = record.ideaConclusion || '';
            renderIdeaTodoOptions(record.ideaTodoId || '');
        }

        function updateIdeaFieldsVisibility() {
            const fields = document.getElementById('idea-fields');
            const type = document.getElementById('record-type')?.value;
            if (!fields) return;
            fields.classList.toggle('active', type === '灵感碎片');
            if (type === '灵感碎片') renderIdeaTodoOptions(document.getElementById('idea-todo-id')?.value || '');
        }

        function getIdeaFormData(type) {
            if (type !== '灵感碎片') {
                return {
                    ideaStatus: '',
                    ideaTags: [],
                    ideaNextAction: '',
                    ideaTodoId: '',
                    ideaConclusion: ''
                };
            }
            return {
                ideaStatus: document.getElementById('idea-status')?.value || '待整理',
                ideaTags: normalizeTagList(document.getElementById('idea-tags')?.value || ''),
                ideaNextAction: document.getElementById('idea-next-action')?.value.trim() || '',
                ideaTodoId: document.getElementById('idea-todo-id')?.value || '',
                ideaConclusion: document.getElementById('idea-conclusion')?.value.trim() || ''
            };
        }

        // 获取表单数据
        function getRecordFormData() {
            const todoIds = tempTodos.map(t => t.id);
            const type = document.getElementById('record-type').value;
            return {
                type,
                title: document.getElementById('record-title').value.trim(),
                startDate: document.getElementById('record-start-date').value,
                endDate: document.getElementById('record-end-date').value,
                recordTime: document.getElementById('record-time').value,
                recordEndTime: document.getElementById('record-end-time').value,
                content: document.getElementById('record-content').value,
                templateId: currentStructuredTemplateId,
                todoIds: todoIds,
                ...getIdeaFormData(type)
            };
        }

        function syncRecordTodos(previousTodoIds = []) {
            tempTodos.forEach(t => {
                const existing = data.todos.find(tt => tt.id === t.id);
                if (existing) {
                    Object.assign(existing, t);
                } else {
                    data.todos.push(t);
                }
            });

            const currentTodoIds = tempTodos.map(t => t.id);
            data.todos = data.todos.filter(t => {
                if (currentTodoIds.includes(t.id)) return true;
                return !(previousTodoIds.includes(t.id) && t.isExclusive);
            });
        }

        function persistCurrentRecord(statusText = null) {
            if (!currentRecordId && !hasMeaningfulRecordInput()) return false;

            const formData = getRecordFormData();
            const now = getLocalDateTimeStr();
            let previousTodoIds = [];
            let record = currentRecordId ? data.records.find(r => r.id === currentRecordId) : null;

            if (!record) {
                const existingRecord = findExistingScopedRecord(formData.type, formData.startDate, formData.endDate);
                if (existingRecord) {
                    currentRecordId = existingRecord.id;
                    record = existingRecord;
                }
            }

            if (record) {
                previousTodoIds = [...(record.todoIds || [])];
                formData.createdAt = record.createdAt || now;
                formData.updatedAt = now;
                if (record.isDraft) record.isDraft = false;
                Object.assign(record, formData);
            } else {
                formData.id = genId();
                formData.createdAt = now;
                formData.updatedAt = now;
                currentRecordId = formData.id;
                data.records.push(formData);
            }

            syncRecordTodos(previousTodoIds);
            saveData();
            isRecordDirty = false;

            if (statusText !== false) {
                document.getElementById('save-status').textContent = statusText || `已自动保存于 ${formatClockTime(new Date(), true)}`;
            }

            return true;
        }

        // 自动保存
        const autoSaveRecord = debounce(function() {
            persistCurrentRecord();
        }, 3000);

        // 手动保存
        function saveRecordManual() {
            if (!persistCurrentRecord('已保存')) {
                closeRecordModal();
                return;
            }
            renderDashboard();
            renderAllRecords();
            refreshKnowledgeViews();
            closeRecordModal();
        }

        // 删除记录
        function deleteRecord() {
            if (!currentRecordId) return;
            if (!confirm('确定删除这条记录吗？关联的专属待办也会一起删除')) return;
            createLocalSnapshot('删除记录前');
            
            const record = data.records.find(r => r.id === currentRecordId);
            if (record && record.todoIds) {
                data.todos
                    .filter(t => record.todoIds.includes(t.id) && t.isExclusive)
                    .forEach(t => markDeletedItem('todos', t.id, { reason: 'record-delete', recordId: currentRecordId }));
                data.todos = data.todos.filter(t => !record.todoIds.includes(t.id) || !t.isExclusive);
            }
            
            markDeletedItem('records', currentRecordId, { reason: 'manual-delete' });
            data.records = data.records.filter(r => r.id !== currentRecordId);
            saveData();
            closeRecordModal();
            renderDashboard();
            renderAllRecords();
        }

        function setRecordView(view, button) {
            currentRecordView = view;
            document.querySelectorAll('#record-view-tabs button').forEach(btn => btn.classList.remove('active'));
            if (button) button.classList.add('active');
            renderAllRecords();
        }

        function updateRecordListRangeControl() {
            const rangeEl = document.getElementById('record-list-range');
            if (rangeEl) rangeEl.style.display = currentRecordView === 'list' ? '' : 'none';
        }

        function shiftRecordCursor(amount) {
            if (currentRecordView === 'month') {
                const date = parseLocalDate(recordCursorDate);
                date.setMonth(date.getMonth() + amount);
                recordCursorDate = formatLocalDateKey(date);
            } else if (currentRecordView === 'week') {
                recordCursorDate = addDays(recordCursorDate, amount * 7);
            } else {
                recordCursorDate = addDays(recordCursorDate, amount);
            }
            renderAllRecords();
        }

        function resetRecordCursor() {
            recordCursorDate = getTodayStr();
            renderAllRecords();
        }

        function getFilteredRecords(options = {}) {
            const { startDate = '', endDate = '' } = options;
            const keyword = (document.getElementById('record-search')?.value || '').trim().toLowerCase();
            const typeFilter = document.getElementById('record-type-filter')?.value || 'all';
            const ideaStatusFilter = document.getElementById('record-idea-status-filter')?.value || 'all';
            const ideaTagFilter = document.getElementById('record-idea-tag-filter')?.value || '';
            return [...data.records]
                .filter(r => !startDate || ((r.startDate || '') >= startDate && (r.startDate || '') <= endDate))
                .filter(r => typeFilter === 'all' || r.type === typeFilter)
                .filter(r => {
                    if (ideaStatusFilter === 'all' && !ideaTagFilter.trim()) return true;
                    if (r.type !== '灵感碎片') return false;
                    if (ideaStatusFilter === 'unprocessed' && !isIdeaUnprocessed(r)) return false;
                    if (ideaStatusFilter === 'needsConclusion' && !ideaNeedsConclusion(r)) return false;
                    if (!['all', 'unprocessed', 'needsConclusion'].includes(ideaStatusFilter) && getIdeaStatus(r) !== ideaStatusFilter) return false;
                    return hasMatchingTag(getIdeaTags(r), ideaTagFilter);
                })
                .filter(r => {
                    if (!keyword) return true;
                    return [r.type, r.title, r.content, r.startDate, r.endDate, getIdeaStatus(r), ...getIdeaTags(r), r.ideaNextAction, r.ideaConclusion]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase()
                        .includes(keyword);
                })
                .sort((a,b) => (b.startDate || '').localeCompare(a.startDate || '') || -getRecordSortValue(a).localeCompare(getRecordSortValue(b)));
        }

        function renderRecordGroups(records) {
            const keyword = (document.getElementById('record-search')?.value || '').trim();
            const typeFilter = document.getElementById('record-type-filter')?.value || 'all';
            const ideaStatusFilter = document.getElementById('record-idea-status-filter')?.value || 'all';
            const ideaTagFilter = (document.getElementById('record-idea-tag-filter')?.value || '').trim();
            const groups = {};
            records.forEach(r => {
                const date = r.startDate;
                if (!groups[date]) groups[date] = [];
                groups[date].push(r);
            });

            if (Object.keys(groups).length === 0) {
                return keyword || typeFilter !== 'all' || ideaStatusFilter !== 'all' || ideaTagFilter
                    ? '<div class="empty-state">没有匹配的记录，换个关键词试试</div>'
                    : '<div class="empty-state">暂无记录</div>';
            }

            return Object.entries(groups).map(([date, groupRecords]) => `
                <div class="timeline-group">
                    <div class="timeline-date">${formatDate(date)}</div>
                    ${sortRecordsInDay(groupRecords).map(r => renderRecordCard(r)).join('')}
                </div>
            `).join('');
        }

        function getRecordViewFilters() {
            return {
                keyword: document.getElementById('record-search')?.value || '',
                typeFilter: document.getElementById('record-type-filter')?.value || 'all'
            };
        }

        function hasRecordIdeaOnlyFilter() {
            const ideaStatusFilter = document.getElementById('record-idea-status-filter')?.value || 'all';
            const ideaTagFilter = (document.getElementById('record-idea-tag-filter')?.value || '').trim();
            return ideaStatusFilter !== 'all' || !!ideaTagFilter;
        }

        function scheduleItemMatchesKeyword(item, keyword = '') {
            const keywordText = String(keyword || '').trim().toLowerCase();
            if (!keywordText) return true;
            const haystack = [item.type, item.title, item.preview, item.meta, item.date, item.timeLabel]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(keywordText);
        }

        function getAllRecordEventItems() {
            const { keyword, typeFilter } = getRecordViewFilters();
            const range = getRecordListRange();
            const recordItems = getFilteredRecords(range).map(record => buildRecordScheduleItem(record));
            if (hasRecordIdeaOnlyFilter()) return recordItems;

            const operationItems = [];
            if (typeFilter === 'all' || typeFilter === '待办') {
                data.todos.forEach(todo => {
                    (todo.sessions || []).forEach(session => {
                        if (!session.date) return;
                        if (range.startDate && (session.date < range.startDate || session.date > range.endDate)) return;
                        const item = buildTodoSessionScheduleItem(todo, session);
                        if (scheduleItemMatchesKeyword(item, keyword)) operationItems.push(item);
                    });
                });
            }

            if (typeFilter === 'all' || typeFilter === '习惯') {
                const seenHabitDates = new Set();
                data.checkins.forEach(checkin => {
                    if (!checkin.habitId || !checkin.date) return;
                    if (range.startDate && (checkin.date < range.startDate || checkin.date > range.endDate)) return;
                    const key = `${checkin.habitId}:${checkin.date}`;
                    if (seenHabitDates.has(key)) return;
                    seenHabitDates.add(key);
                    const habit = data.habits.find(item => item.id === checkin.habitId);
                    if (!habit) return;
                    const item = buildHabitScheduleItem(habit, checkin.date);
                    if (item.done && scheduleItemMatchesKeyword(item, keyword)) operationItems.push(item);
                });
            }

            return [...recordItems, ...operationItems];
        }

        function getViewScheduleItems(startDate, endDate) {
            const filters = getRecordViewFilters();
            const recordItems = getFilteredRecords({ startDate, endDate }).map(record => buildRecordScheduleItem(record));
            const operationItems = hasRecordIdeaOnlyFilter() ? [] : buildScheduleItemsForRange(startDate, endDate, {
                ...filters,
                includeRecords: false,
                includeTodos: true,
                includeHabits: true,
                includeTodoPlans: false,
                includeTodoDue: false,
                includeTodoSessions: true
            });
            return [...recordItems, ...operationItems];
        }

        function renderRecordEventGroups(items) {
            const keyword = (document.getElementById('record-search')?.value || '').trim();
            const typeFilter = document.getElementById('record-type-filter')?.value || 'all';
            const ideaStatusFilter = document.getElementById('record-idea-status-filter')?.value || 'all';
            const ideaTagFilter = (document.getElementById('record-idea-tag-filter')?.value || '').trim();
            const groups = {};
            items.forEach(item => {
                if (!groups[item.date]) groups[item.date] = [];
                groups[item.date].push(item);
            });

            if (Object.keys(groups).length === 0) {
                return keyword || typeFilter !== 'all' || ideaStatusFilter !== 'all' || ideaTagFilter
                    ? '<div class="empty-state">没有匹配的记录，换个关键词试试</div>'
                    : '<div class="empty-state">暂无记录</div>';
            }

            return Object.entries(groups)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, groupItems]) => `
                    <div class="timeline-group">
                        <div class="timeline-date">${formatDate(date)}</div>
                        ${sortScheduleItemsInDay(groupItems).map(item => {
                            if (item.sourceType === 'record') {
                                const record = data.records.find(recordItem => recordItem.id === item.id);
                                return record ? renderRecordCard(record) : renderScheduleCard(item);
                            }
                            return renderScheduleCard(item);
                        }).join('')}
                    </div>
                `).join('');
        }

        function renderMonthCalendar(items, monthCursorDate) {
            const weekNames = ['周一','周二','周三','周四','周五','周六','周日'];
            const start = getMonthStart(monthCursorDate);
            const end = getMonthEnd(monthCursorDate);
            const cursor = parseLocalDate(monthCursorDate);
            document.getElementById('record-view-title').textContent = `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;
            const byDate = {};
            items.forEach(item => {
                if (!byDate[item.date]) byDate[item.date] = [];
                byDate[item.date].push(item);
            });

            const firstWeekStart = getWeekStart(start);
            const lastDate = parseLocalDate(end);
            const lastDay = lastDate.getDay() || 7;
            const gridEnd = addDays(end, 7 - lastDay);
            const dates = [];
            for (let d = firstWeekStart; d <= gridEnd; d = addDays(d, 1)) dates.push(d);

            return `
                <div class="record-calendar">
                    <div class="calendar-grid">
                        ${weekNames.map(name => `<div class="calendar-head">${name}</div>`).join('')}
                        ${dates.map(date => {
                            const dayItems = sortScheduleItemsInDay(byDate[date] || []);
                            const isToday = date === getTodayStr();
                            const toneEvents = dayItems.slice(0, 5).map(item => {
                                const toneStyle = `--event-bg:${item.tone.bg}; --event-border:${item.tone.border}; --event-ink:${item.tone.ink};`;
                                const prefix = item.allDay ? '' : `${formatMinutesLabel(item.startMinutes)} `;
                                const className = item.done ? 'calendar-event is-done' : 'calendar-event';
                                return `<div class="${className}" style="${toneStyle}" onclick="${item.click}" title="${escapeHtml(item.title)}">${prefix}${escapeHtml(item.title)}</div>`;
                            }).join('');
                            return `
                                <div class="calendar-cell ${isToday ? 'is-today' : ''}">
                                    <div class="calendar-date">
                                        <span>${parseLocalDate(date).getDate()}</span>
                                        <small>${isToday ? '今天' : ''}</small>
                                    </div>
                                    <div class="calendar-cell-body">
                                        ${toneEvents}
                                        ${dayItems.length > 5 ? `<div class="calendar-more">还有 ${dayItems.length - 5} 个事项</div>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        function renderAgendaView(items, dates, mode) {
            const hourHeight = mode === 'week' ? 54 : 62;
            const startHour = 6;
            const endHour = 23;
            const hours = [];
            for (let hour = startHour; hour <= endHour; hour++) hours.push(hour);

            const byDate = {};
            dates.forEach(date => { byDate[date] = { allDay: [], timed: [] }; });
            items.forEach(item => {
                if (!byDate[item.date]) return;
                if (item.allDay || item.startMinutes === null) byDate[item.date].allDay.push(item);
                else byDate[item.date].timed.push(item);
            });

            dates.forEach(date => {
                byDate[date].allDay = sortScheduleItemsInDay(byDate[date].allDay);
                byDate[date].timed = layoutTimedItems(byDate[date].timed);
            });

            const title = mode === 'day'
                ? formatDate(dates[0])
                : `${formatDate(dates[0])} ~ ${formatDate(dates[dates.length - 1])}`;
            document.getElementById('record-view-title').textContent = title;

            return `
                <div class="agenda-shell agenda-${mode}" style="--agenda-hour-height:${hourHeight}px;">
                    <div class="agenda-head" style="grid-template-columns: 72px repeat(${dates.length}, minmax(0, 1fr));">
                        <div class="agenda-corner"></div>
                        ${dates.map(date => {
                            const d = parseLocalDate(date);
                            const weekLabel = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
                            return `
                                <div class="agenda-day-head ${date === getTodayStr() ? 'is-today' : ''}">
                                    <div class="agenda-day-label">${weekLabel}</div>
                                    <div><span class="agenda-day-number">${d.getDate()}</span>${date === getTodayStr() ? '<span class="agenda-day-extra">今天</span>' : ''}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="agenda-all-day" style="grid-template-columns: 72px repeat(${dates.length}, minmax(0, 1fr));">
                        <div class="agenda-all-day-label">全天事项</div>
                        ${dates.map(date => {
                            const allDayItems = byDate[date].allDay;
                            return `
                                <div class="agenda-all-day-cell">
                                    ${allDayItems.slice(0, 3).map(item => {
                                        const toneStyle = `--event-bg:${item.tone.bg}; --event-border:${item.tone.border}; --event-ink:${item.tone.ink};`;
                                        return `<div class="agenda-all-day-item ${item.done ? 'is-done' : ''}" style="${toneStyle}" onclick="${item.click}" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>`;
                                    }).join('')}
                                    ${allDayItems.length > 3 ? `<div class="agenda-more">还有 ${allDayItems.length - 3} 项</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="agenda-body">
                        <div class="agenda-time-axis">
                            ${hours.map(hour => `<div class="agenda-hour-label">${String(hour).padStart(2, '0')}:00</div>`).join('')}
                        </div>
                        <div class="agenda-columns">
                            <div class="agenda-columns-grid" style="grid-template-columns: repeat(${dates.length}, minmax(0, 1fr));">
                                ${dates.map(date => `
                                    <div class="agenda-day-column ${date === getTodayStr() ? 'is-today' : ''}">
                                        ${hours.map(() => '<div class="agenda-hour-slot"></div>').join('')}
                                        <div class="agenda-event-layer">
                                            ${byDate[date].timed.map(item => {
                                                const toneStyle = `--event-bg:${item.tone.bg}; --event-border:${item.tone.border}; --event-ink:${item.tone.ink};`;
                                                const top = Math.max((item.startMinutes - startHour * 60) * hourHeight / 60, 0);
                                                const hasExplicitEnd = item.endMinutes !== null && item.endMinutes > item.startMinutes;
                                                const visualEnd = hasExplicitEnd ? item.endMinutes : item.startMinutes;
                                                const height = Math.max((visualEnd - item.startMinutes) * hourHeight / 60, hasExplicitEnd ? 22 : 18);
                                                const gap = 2;
                                                const columnCount = item.layoutColumns || 1;
                                                const columnIndex = item.layoutColumn || 0;
                                                const width = `calc((100% - 8px - ${gap * (columnCount - 1)}px) / ${columnCount})`;
                                                const left = `calc(4px + (${width} + ${gap}px) * ${columnIndex})`;
                                                const densityClass = [
                                                    height < 46 ? 'is-short' : '',
                                                    columnCount > 1 ? 'is-overlap' : ''
                                                ].filter(Boolean).join(' ');
                                                const timeText = `${formatMinutesLabel(item.startMinutes)}${hasExplicitEnd ? ` - ${formatMinutesLabel(item.endMinutes)}` : ''}`;
                                                return `
                                                    <div class="agenda-event-block ${item.done ? 'is-done' : ''} ${densityClass}" style="${toneStyle}; top:${top}px; height:${height}px; left:${left}; width:${width};" onclick="${item.click}" title="${escapeHtml(`${timeText} ${item.title}`)}">
                                                        <div class="agenda-event-time">${timeText}</div>
                                                        <div class="agenda-event-title">${escapeHtml(item.title)}</div>
                                                        ${item.meta ? `<div class="agenda-event-meta">${escapeHtml(item.meta)}</div>` : ''}
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 所有记录页渲染
        function renderAllRecords() {
            const container = document.getElementById('all-records');
            updateRecordListRangeControl();

            if (currentRecordView === 'list') {
                document.getElementById('record-view-title').textContent = '全部记录';
                container.innerHTML = renderRecordEventGroups(getAllRecordEventItems());
                return;
            }

            if (currentRecordView === 'day') {
                container.innerHTML = renderAgendaView(
                    getViewScheduleItems(recordCursorDate, recordCursorDate),
                    [recordCursorDate],
                    'day'
                );
                return;
            }

            if (currentRecordView === 'week') {
                const weekStart = getWeekStart(recordCursorDate);
                const dates = [];
                for (let i = 0; i < 7; i++) dates.push(addDays(weekStart, i));
                container.innerHTML = renderAgendaView(
                    getViewScheduleItems(weekStart, dates[6]),
                    dates,
                    'week'
                );
                return;
            }

            const monthStart = getMonthStart(recordCursorDate);
            const monthEnd = getMonthEnd(recordCursorDate);
            const firstWeekStart = getWeekStart(monthStart);
            const lastDate = parseLocalDate(monthEnd);
            const lastDay = lastDate.getDay() || 7;
            const gridEnd = addDays(monthEnd, 7 - lastDay);
            container.innerHTML = renderMonthCalendar(
                getViewScheduleItems(firstWeekStart, gridEnd),
                recordCursorDate
            );
        }

        // ================== 灵感池 ==================
        function getFilteredIdeas() {
            const keyword = (document.getElementById('idea-search')?.value || '').trim().toLowerCase();
            const statusFilter = document.getElementById('idea-status-filter')?.value || 'all';
            const tagFilter = document.getElementById('idea-tag-filter')?.value || '';
            return recordsService.filterIdeas(data.records, {
                keyword,
                statusFilter,
                tagFilter,
                hasMatchingTag: (tags, query) => hasMatchingTag(tags, query),
                getRecordSortValue: record => getRecordSortValue(record)
            });
        }

        function renderIdeaSummary(ideas) {
            const container = document.getElementById('idea-pool-summary');
            if (!container) return;
            const counts = IDEA_STATUS_OPTIONS.map(status => ({
                status,
                count: data.records.filter(record => record.type === '灵感碎片' && getIdeaStatus(record) === status).length
            }));
            const unprocessed = data.records.filter(record => record.type === '灵感碎片' && isIdeaUnprocessed(record)).length;
            container.innerHTML = `
                <div class="mini-summary-card"><strong>${data.records.filter(record => record.type === '灵感碎片').length}</strong><span>全部灵感</span></div>
                <div class="mini-summary-card"><strong>${unprocessed}</strong><span>未处理</span></div>
                ${counts.map(item => `<div class="mini-summary-card"><strong>${item.count}</strong><span>${item.status}</span></div>`).join('')}
            `;
        }

        function truncateIdeaPreview(text = '', maxLen = 80) {
            const normalized = String(text || '').replace(/\s+/g, ' ').trim();
            if (!normalized) return '还没有正文';
            if (normalized.length <= maxLen) return normalized;
            return `${normalized.slice(0, maxLen).trimEnd()}…`;
        }

        function renderIdeaPool() {
            const list = document.getElementById('idea-pool-list');
            if (!list) return;
            const ideas = getFilteredIdeas();
            renderIdeaSummary(ideas);
            if (!ideas.length) {
                list.innerHTML = '<div class="empty-state">暂无匹配的灵感</div>';
                return;
            }
            list.innerHTML = `<div class="idea-grid">${ideas.map(record => {
                const todo = getIdeaTodo(record);
                const preview = truncateIdeaPreview(record.content || '', 80);
                return `
                    <article class="idea-card">
                        <div class="idea-card-head">
                            <span class="item-type type-灵感碎片">灵感碎片</span>
                            ${renderIdeaBadges(record)}
                        </div>
                        <h3>${escapeHtml(record.title || '未命名灵感')}</h3>
                        <div class="idea-card-preview" title="${escapeHtml((record.content || '').replace(/\s+/g, ' ').trim())}">${escapeHtml(preview)}</div>
                        <div class="idea-card-actions">
                            <button class="btn btn-secondary todo-mini-btn" onclick="openRecordPreview(${escapeJsArg(record.id)})">查看</button>
                            <button class="btn btn-secondary todo-mini-btn" onclick="convertIdeaToTodo(${escapeJsArg(record.id)})">${todo ? '打开待办' : '转成待办'}</button>
                            <button class="btn btn-primary todo-mini-btn" onclick="openRecordModal(${escapeJsArg(record.id)})">编辑推进</button>
                        </div>
                    </article>
                `;
            }).join('')}</div>`;
        }

        function getIdeaTodoText(record) {
            return recordsService.getIdeaTodoText(record);
        }

        function getIdeaTodoNote(record) {
            return recordsService.getIdeaTodoNote(record);
        }

        function convertIdeaToTodo(recordId) {
            const record = data.records.find(item => item.id === recordId && item.type === '灵感碎片');
            if (!record) return;
            const existingTodo = getIdeaTodo(record);
            if (existingTodo) {
                openTodoDetail(existingTodo.id);
                return;
            }

            openIdeaTodoDraft(record);
        }

        function jumpToIdeas(status = 'all', tag = '') {
            navigateToPage('ideas');
            const statusEl = document.getElementById('idea-status-filter');
            const tagEl = document.getElementById('idea-tag-filter');
            const searchEl = document.getElementById('idea-search');
            if (statusEl) statusEl.value = status;
            if (tagEl) tagEl.value = tag || '';
            if (searchEl) searchEl.value = '';
            renderIdeaPool();
        }

        function jumpToMaterials(tag = '') {
            navigateToPage('materials');
            const tagEl = document.getElementById('material-tag-filter');
            const searchEl = document.getElementById('material-search');
            const typeEl = document.getElementById('material-type-filter');
            if (tagEl) tagEl.value = tag || '';
            if (searchEl) searchEl.value = '';
            if (typeEl) typeEl.value = 'all';
            renderMaterialsPage();
        }

        function jumpToWheelTag(tagId = '') {
            navigateToPage('wheel');
            currentWheelPanel = 'tags';
            renderWheelPage();
            if (tagId) {
                setTimeout(() => {
                    const row = Array.from(document.querySelectorAll('[data-wheel-tag-id]'))
                        .find(item => item.getAttribute('data-wheel-tag-id') === tagId);
                    if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }, 50);
            }
        }

        // ================== 标签中心 ==================
        function getTagCenterItems() {
            const map = new Map();
            const ensure = (name) => {
                const clean = String(name || '').trim();
                if (!clean) return null;
                const key = clean.toLowerCase();
                if (!map.has(key)) {
                    map.set(key, {
                        name: clean,
                        ideas: [],
                        materials: [],
                        wheelItems: [],
                        wheelTags: []
                    });
                }
                return map.get(key);
            };

            data.records
                .filter(record => record.type === '灵感碎片')
                .forEach(record => getIdeaTags(record).forEach(tag => ensure(tag)?.ideas.push(record)));

            data.materials.forEach(material => {
                normalizeTagList(material.tags).forEach(tag => ensure(tag)?.materials.push(material));
            });

            data.wheelTags.forEach(tag => {
                const item = ensure(tag.name);
                if (item) item.wheelTags.push(tag);
            });

            data.wheelLibraryItems.forEach(libraryItem => {
                (libraryItem.tagIds || []).forEach(tagId => {
                    const tag = data.wheelTags.find(item => item.id === tagId);
                    const centerItem = ensure(tag?.name);
                    if (centerItem) centerItem.wheelItems.push(libraryItem);
                });
            });

            return Array.from(map.values()).sort((a, b) => {
                const totalB = b.ideas.length + b.materials.length + b.wheelItems.length + b.wheelTags.length;
                const totalA = a.ideas.length + a.materials.length + a.wheelItems.length + a.wheelTags.length;
                return totalB - totalA || a.name.localeCompare(b.name, 'zh-CN');
            });
        }

        function getFilteredTagCenterItems() {
            const keyword = (document.getElementById('tag-center-search')?.value || '').trim().toLowerCase();
            const scope = document.getElementById('tag-center-scope')?.value || 'all';
            return getTagCenterItems()
                .filter(item => {
                    if (scope === 'ideas') return item.ideas.length > 0;
                    if (scope === 'materials') return item.materials.length > 0;
                    if (scope === 'wheel') return item.wheelItems.length > 0 || item.wheelTags.length > 0;
                    return true;
                })
                .filter(item => !keyword || item.name.toLowerCase().includes(keyword));
        }

        function renderTagCenterSummary(items) {
            const container = document.getElementById('tag-center-summary');
            if (!container) return;
            const all = getTagCenterItems();
            const ideaTags = all.filter(item => item.ideas.length).length;
            const materialTags = all.filter(item => item.materials.length).length;
            const wheelTags = all.filter(item => item.wheelItems.length || item.wheelTags.length).length;
            container.innerHTML = `
                <div class="mini-summary-card"><strong>${all.length}</strong><span>全部标签</span></div>
                <div class="mini-summary-card"><strong>${ideaTags}</strong><span>灵感标签</span></div>
                <div class="mini-summary-card"><strong>${materialTags}</strong><span>素材标签</span></div>
                <div class="mini-summary-card"><strong>${wheelTags}</strong><span>转盘标签</span></div>
                <div class="mini-summary-card"><strong>${items.length}</strong><span>当前筛选</span></div>
            `;
        }

        function renderTagCenter() {
            const list = document.getElementById('tag-center-list');
            if (!list) return;
            const items = getFilteredTagCenterItems();
            renderTagCenterSummary(items);
            if (!items.length) {
                list.innerHTML = '<div class="empty-state">暂无匹配标签</div>';
                return;
            }
            list.innerHTML = `<div class="tag-center-grid">${items.map(item => {
                const wheelTag = item.wheelTags[0];
                const total = item.ideas.length + item.materials.length + item.wheelItems.length;
                return `
                    <article class="tag-center-card">
                        <div class="tag-center-head">
                            <span class="tag-pill">${escapeHtml(item.name)}</span>
                            <strong>${total}</strong>
                        </div>
                        <div class="tag-center-counts">
                            <button onclick="jumpToIdeas('all', ${escapeJsArg(item.name)})"><strong>${item.ideas.length}</strong><span>灵感</span></button>
                            <button onclick="jumpToMaterials(${escapeJsArg(item.name)})"><strong>${item.materials.length}</strong><span>素材</span></button>
                            <button onclick="jumpToWheelTag(${escapeJsArg(wheelTag?.id || '')})"><strong>${item.wheelItems.length}</strong><span>转盘项</span></button>
                        </div>
                        <div class="tag-center-preview">
                            ${item.ideas[0] ? `<span>灵感：${escapeHtml(item.ideas[0].title || '未命名灵感')}</span>` : ''}
                            ${item.materials[0] ? `<span>素材：${escapeHtml((item.materials[0].content || '').slice(0, 34))}</span>` : ''}
                            ${item.wheelItems[0] ? `<span>转盘：${escapeHtml(item.wheelItems[0].name || '未命名公共项')}</span>` : ''}
                        </div>
                    </article>
                `;
            }).join('')}</div>`;
        }

        // ================== 素材库 ==================
        function getAllMaterialTags() {
            return Array.from(new Set(data.materials.flatMap(material => normalizeTagList(material.tags)))).sort((a, b) => a.localeCompare(b, 'zh-CN'));
        }

        function getFilteredMaterials() {
            const keyword = (document.getElementById('material-search')?.value || '').trim().toLowerCase();
            const typeFilter = document.getElementById('material-type-filter')?.value || 'all';
            const tagFilter = document.getElementById('material-tag-filter')?.value || '';
            return [...data.materials]
                .filter(material => typeFilter === 'all' || material.type === typeFilter)
                .filter(material => hasMatchingTag(material.tags, tagFilter))
                .filter(material => {
                    if (!keyword) return true;
                    return [material.type, material.content, material.source, material.note, ...normalizeTagList(material.tags)]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase()
                        .includes(keyword);
                })
                .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        }

        function renderMaterialCard(material, compact = false) {
            const tags = normalizeTagList(material.tags);
            return `
                <article class="material-card ${compact ? 'compact' : ''}">
                    <div class="material-card-head">
                        <span class="material-type">${escapeHtml(material.type || '素材')}</span>
                        <span>${escapeHtml(formatStoredDateTime(material.createdAt || ''))}</span>
                    </div>
                    <div class="material-content">${escapeHtml(material.content || '空素材')}</div>
                    ${tags.length ? `<div class="idea-badge-row">${tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                    ${material.source ? `<div class="material-meta">来源：${escapeHtml(material.source)}</div>` : ''}
                    ${material.note ? `<div class="material-meta">备注：${escapeHtml(material.note)}</div>` : ''}
                    ${compact ? '' : `
                        <div class="idea-card-actions">
                            <button class="btn btn-secondary todo-mini-btn" onclick="openMaterialModal(${escapeJsArg(material.id)})">编辑</button>
                        </div>
                    `}
                </article>
            `;
        }

        function renderMaterialTagPicker() {
            const container = document.getElementById('material-tag-picker');
            if (!container) return;
            const tags = getAllMaterialTags();
            if (!selectedMaterialRandomTags.length && tags.length) selectedMaterialRandomTags = tags.slice(0, Math.min(3, tags.length));
            if (!tags.length) {
                container.innerHTML = '<div class="empty-state">先给素材添加标签后，这里会出现随机展示筛选。</div>';
                return;
            }
            container.innerHTML = tags.map(tag => `
                <label class="tag-check">
                    <input type="checkbox" ${selectedMaterialRandomTags.includes(tag) ? 'checked' : ''} onchange="toggleMaterialRandomTag(${escapeJsArg(tag)}, this.checked)">
                    <span>${escapeHtml(tag)}</span>
                </label>
            `).join('');
        }

        function getRandomMaterials() {
            const pool = data.materials.filter(material => {
                const tags = normalizeTagList(material.tags);
                return selectedMaterialRandomTags.length === 0 || tags.some(tag => selectedMaterialRandomTags.includes(tag));
            });
            return sampleRandomItems(pool, 3);
        }

        function renderMaterialRandom() {
            const container = document.getElementById('material-random-list');
            if (!container) return;
            const picked = getRandomMaterials();
            container.innerHTML = picked.length
                ? picked.map(material => renderMaterialCard(material, true)).join('')
                : '<div class="empty-state">当前标签下没有可展示素材</div>';
        }

        function renderMaterialsPage() {
            const list = document.getElementById('material-list');
            if (!list) return;
            renderMaterialTagPicker();
            renderMaterialRandom();
            const materials = getFilteredMaterials();
            list.innerHTML = materials.length
                ? materials.map(material => renderMaterialCard(material)).join('')
                : '<div class="empty-state">暂无匹配素材</div>';
        }

        function refreshMaterialRandom() {
            renderMaterialRandom();
        }

        function toggleMaterialRandomTag(tag, checked) {
            const set = new Set(selectedMaterialRandomTags);
            if (checked) set.add(tag);
            else set.delete(tag);
            selectedMaterialRandomTags = Array.from(set);
            renderMaterialRandom();
        }

        function openMaterialModal(materialId = '') {
            currentMaterialId = materialId || null;
            const material = currentMaterialId ? data.materials.find(item => item.id === currentMaterialId) : null;
            document.getElementById('material-modal-title').textContent = material ? '编辑素材' : '新增素材';
            document.getElementById('material-type').value = material?.type || '摘抄';
            document.getElementById('material-content').value = material?.content || '';
            document.getElementById('material-tags').value = tagsToInput(material?.tags || []);
            document.getElementById('material-source').value = material?.source || '';
            document.getElementById('material-note').value = material?.note || '';
            document.getElementById('delete-material-btn').style.display = material ? '' : 'none';
            document.getElementById('material-modal').classList.add('active');
            document.getElementById('material-content').focus();
        }

        function closeMaterialModal() {
            document.getElementById('material-modal').classList.remove('active');
            currentMaterialId = null;
            const contentEl = document.getElementById('material-content');
            const tagsEl = document.getElementById('material-tags');
            const sourceEl = document.getElementById('material-source');
            const noteEl = document.getElementById('material-note');
            if (contentEl) contentEl.value = '';
            if (tagsEl) tagsEl.value = '';
            if (sourceEl) sourceEl.value = '';
            if (noteEl) noteEl.value = '';
        }

        function saveMaterial() {
            const content = document.getElementById('material-content').value.trim();
            if (!content) {
                alert('请输入素材内容');
                return;
            }
            const now = getLocalDateTimeStr();
            const materialData = {
                type: document.getElementById('material-type').value || '摘抄',
                content,
                tags: normalizeTagList(document.getElementById('material-tags').value || ''),
                source: document.getElementById('material-source').value.trim(),
                note: document.getElementById('material-note').value.trim(),
                updatedAt: now
            };
            const existing = currentMaterialId ? data.materials.find(item => item.id === currentMaterialId) : null;
            if (existing) {
                Object.assign(existing, materialData);
            } else {
                data.materials.unshift({
                    id: genId(),
                    ...materialData,
                    createdAt: now
                });
            }
            saveData();
            closeMaterialModal();
            renderMaterialsPage();
            renderTagCenter();
            renderDashboard();
            renderGlobalSearch();
        }

        function deleteCurrentMaterial() {
            if (!currentMaterialId) return;
            if (!confirm('确定删除这条素材吗？')) return;
            markDeletedItem('materials', currentMaterialId, { reason: 'manual-delete' });
            data.materials = data.materials.filter(item => item.id !== currentMaterialId);
            saveData();
            closeMaterialModal();
            renderMaterialsPage();
            renderTagCenter();
            renderDashboard();
            renderGlobalSearch();
        }

        // ================== 全局搜索 ==================
        const SEARCH_MODULE_LABELS = {
            records: '记录',
            todos: '待办',
            goals: '目标',
            materials: '素材库',
            templates: '模板',
            wheel: '转盘公共项'
        };

        function buildGlobalSearchIndex() {
            const recordItems = data.records.map(record => ({
                module: 'records',
                title: record.title || record.type || '未命名记录',
                subtitle: `${record.type || '记录'} · ${getRecordDateRangeLabel(record)}`,
                body: record.content || '',
                tags: record.type === '灵感碎片' ? getIdeaTags(record) : [],
                meta: [getIdeaStatus(record), record.ideaNextAction, record.ideaConclusion].filter(Boolean).join(' '),
                open: `openRecordPreview('${record.id}')`
            }));
            const todoItems = data.todos.map(todo => ({
                module: 'todos',
                title: todo.text || '未命名待办',
                subtitle: `${todo.group || '其他'} · ${todo.done ? '已完成' : '未完成'} · ${formatTodoDueDate(todo)}`,
                body: [getTodoPlanLabel(todo), ...(todo.subTodos || []).map(item => item.text), ...(todo.sessions || []).map(item => item.note)].join(' '),
                tags: [todo.group || '其他'],
                meta: todo.urgency || '',
                open: `openTodoDetail('${todo.id}')`
            }));
            const goalItems = data.goals.map(goal => ({
                module: 'goals',
                title: goal.name || '未命名目标',
                subtitle: `${goal.status || '进行中'} · ${goal.period || '未设置周期'}`,
                body: `${goal.target || ''} ${goal.progress || 0}%`,
                tags: [goal.status, goal.period].filter(Boolean),
                meta: goal.target || '',
                open: `openGoalDetail('${goal.id}')`
            }));
            const materialItems = data.materials.map(material => ({
                module: 'materials',
                title: material.content.slice(0, 42) || '空素材',
                subtitle: `${material.type || '素材'} · ${formatStoredDateTime(material.createdAt || '')}`,
                body: `${material.content || ''} ${material.source || ''} ${material.note || ''}`,
                tags: normalizeTagList(material.tags),
                meta: material.source || material.note || '',
                open: `openMaterialModal('${material.id}')`
            }));
            const templateItems = data.templates.map(template => ({
                module: 'templates',
                title: template.name || '未命名模板',
                subtitle: template.type || '模板',
                body: `${template.content || ''} ${(template.todos || []).map(todo => todo.text).join(' ')}`,
                tags: [template.type].filter(Boolean),
                meta: `${(template.todos || []).length} 个模板待办`,
                open: `openTemplateManage()`
            }));
            const wheelItems = data.wheelLibraryItems.map(item => ({
                module: 'wheel',
                title: item.name || '未命名公共项',
                subtitle: `转盘公共项 · 权重 ${item.weight || 1}`,
                body: item.note || '',
                tags: item.tagIds
                    .map(tagId => data.wheelTags.find(tag => tag.id === tagId)?.name)
                    .filter(Boolean),
                meta: item.enabled === false ? '已停用' : '启用中',
                open: `switchPage('wheel', Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent.includes('工具转盘'))); setWheelPanel('library')`
            }));
            return [...recordItems, ...todoItems, ...goalItems, ...materialItems, ...templateItems, ...wheelItems];
        }

        function matchesGlobalSearch(item, keyword) {
            if (!keyword) return true;
            const haystack = [item.module, item.title, item.subtitle, item.body, item.meta, ...(item.tags || [])]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(keyword);
        }

        function renderGlobalSearch() {
            const container = document.getElementById('global-search-results');
            if (!container) return;
            if (globalSearchDebounceTimer) {
                clearTimeout(globalSearchDebounceTimer);
                globalSearchDebounceTimer = null;
            }
            if (typeof window !== 'undefined' && typeof window.__lifePlanSearchRenderCount === 'number') {
                window.__lifePlanSearchRenderCount += 1;
            }
            const keyword = (document.getElementById('global-search-input')?.value || '').trim().toLowerCase();
            const scope = document.getElementById('global-search-scope')?.value || 'all';
            const items = buildGlobalSearchIndex()
                .filter(item => scope === 'all' || item.module === scope)
                .filter(item => matchesGlobalSearch(item, keyword));

            if (!keyword) {
                container.innerHTML = '<div class="empty-state">输入关键词后开始搜索，或选择一个模块缩小范围。</div>';
                return;
            }
            if (!items.length) {
                container.innerHTML = '<div class="empty-state">没有找到匹配内容</div>';
                return;
            }

            const groups = {};
            items.forEach(item => {
                if (!groups[item.module]) groups[item.module] = [];
                groups[item.module].push(item);
            });
            container.innerHTML = Object.entries(groups).map(([module, groupItems]) => `
                <section class="search-group">
                    <div class="search-group-title">${SEARCH_MODULE_LABELS[module] || module} · ${groupItems.length}</div>
                    <div class="search-result-list">
                        ${groupItems.map(item => `
                            <article class="search-result-item" onclick="${item.open}">
                                <div class="search-result-main">
                                    <strong>${escapeHtml(item.title)}</strong>
                                    <span>${escapeHtml(item.subtitle || '')}</span>
                                    ${item.body ? `<p>${escapeHtml(String(item.body).replace(/\s+/g, ' ').slice(0, 120))}</p>` : ''}
                                    ${(item.tags || []).length ? `<div class="idea-badge-row">${item.tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                                </div>
                                <span class="material-type">${escapeHtml(SEARCH_MODULE_LABELS[module] || module)}</span>
                            </article>
                        `).join('')}
                    </div>
                </section>
            `).join('');
        }

        function scheduleGlobalSearchRender(delay = 250) {
            clearTimeout(globalSearchDebounceTimer);
            globalSearchDebounceTimer = setTimeout(() => {
                globalSearchDebounceTimer = null;
                renderGlobalSearch();
            }, delay);
        }

        // ================== 模板管理 ==================
        function refreshTemplateSelect(type) {
            const select = document.getElementById('template-select');
            const typeTemplates = data.templates.filter(t => t.type === type);
            const builtIns = builtInTemplates.filter(t => t.type === type);
            
            const builtInOptions = builtIns.length
                ? `<optgroup label="内置模板">${builtIns.map(t => `<option value="${escapeHtml(`builtin:${t.id}`)}">${escapeHtml(t.name)}</option>`).join('')}</optgroup>`
                : '';
            const customOptions = typeTemplates.length
                ? `<optgroup label="我的模板">${typeTemplates.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('')}</optgroup>`
                : '';

            select.innerHTML = '<option value="">空白</option>' + builtInOptions + customOptions;
        }

        function applyTemplate() {
            const templateId = document.getElementById('template-select').value;
            if (!templateId) {
                resetStructuredTemplateEditor();
                return;
            }
            
            const template = templateId.startsWith('builtin:')
                ? builtInTemplates.find(t => t.id === templateId.replace('builtin:', ''))
                : data.templates.find(t => t.id === templateId);
            if (!template) return;

            if (template.builtIn && template.fields) {
                currentStructuredTemplateId = template.id;
                currentTemplateFields = {};
                renderStructuredTemplateEditor(template, currentTemplateFields);
                document.getElementById('record-content').value = composeTemplateContent(template, currentTemplateFields);
            } else {
                resetStructuredTemplateEditor();
                if (template.content) {
                    document.getElementById('record-content').value = template.content;
                }
            }

            if (template.todos && template.todos.length > 0) {
                tempTodos = template.todos.map(t => ({
                    ...t,
                    id: genId(),
                    dueDate: document.getElementById('record-end-date').value || getTodayStr()
                }));
                renderRecordTodos();
            }
            scheduleRecordAutoSave();
        }

        function saveAsTemplate() {
            const name = prompt('请输入模板名称：');
            if (!name) return;
            
            const type = document.getElementById('record-type').value;
            const newTemplate = {
                id: genId(),
                name: name,
                type: type,
                content: document.getElementById('record-content').value,
                todos: JSON.parse(JSON.stringify(tempTodos))
            };
            
            data.templates.push(newTemplate);
            saveData();
            refreshTemplateSelect(type);
            alert('模板保存成功');
        }

        function openTemplateManage() {
            const container = document.getElementById('template-list');
            
            if (data.templates.length === 0) {
                container.innerHTML = '<div class="empty-state">暂无自定义模板。内置模板会直接出现在对应记录类型的模板下拉里。</div>';
            } else {
                container.innerHTML = '<div style="font-size:12px; color:#647269; margin-bottom:10px;">这里只管理你自己保存的模板，内置模板会自动显示。</div>' + data.templates.map(t => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f0f0f0;">
                        <div>
                            <div style="font-size:14px; font-weight:500;">${escapeHtml(t.name)}</div>
                            <div style="font-size:12px; color:#999;">${escapeHtml(t.type)}</div>
                        </div>
                        <button class="btn btn-danger" style="padding:4px 10px; font-size:12px;" onclick="deleteTemplate(${escapeJsArg(t.id)})">删除</button>
                    </div>
                `).join('');
            }
            
            document.getElementById('template-modal').classList.add('active');
        }

        function closeTemplateManage() {
            document.getElementById('template-modal').classList.remove('active');
        }

        function deleteTemplate(id) {
            if (!confirm('确定删除这个模板吗？')) return;
            const template = data.templates.find(t => t.id === id);
            markDeletedItem('templates', id, { reason: 'manual-delete', name: template?.name || '' });
            data.templates = data.templates.filter(t => t.id !== id);
            saveData();
            openTemplateManage();
        }

        // ================== 待办总览 ==================
        function toggleTodo(todoId) {
            const todo = data.todos.find(t => t.id === todoId);
            if (todo) {
                todosService.toggleTodoDone(todo, new Date());
                saveData();
                renderDashboard();
                renderTodoTable();
                renderAllRecords();
            }
        }

        function renderTodoTable() {
            const start = document.getElementById('filter-start').value;
            const end = document.getElementById('filter-end').value;
            const status = document.getElementById('filter-status').value;
            const urgency = document.getElementById('filter-urgency')?.value || 'all';
            const group = document.getElementById('filter-group').value;
            const mode = document.getElementById('filter-mode').value;

            let filtered = [...data.todos];
            
            if (start || end) filtered = filtered.filter(t => isTodoInDateRange(t, start, end));
            if (status === 'todo') filtered = filtered.filter(t => !t.done);
            if (status === 'done') filtered = filtered.filter(t => t.done);
            if (urgency !== 'all') filtered = filtered.filter(t => (t.urgency || 'medium') === urgency);
            if (group !== 'all') filtered = filtered.filter(t => t.group === group);
            if (mode === 'exclusive') filtered = filtered.filter(t => t.isExclusive);
            if (mode === 'shared') filtered = filtered.filter(t => !t.isExclusive);

            filtered.sort(compareTodosForFocus);

            const tbody = document.getElementById('todo-table-body');
            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无符合条件的待办</td></tr>';
                return;
            }

            tbody.innerHTML = filtered.map(t => {
                const recordIds = data.records.filter(r => r.todoIds?.includes(t.id)).map(r => r.id);
                const recordNames = recordIds.map(id => {
                    const r = data.records.find(rr => rr.id === id);
                    return r ? (r.title || r.type) : '无';
                }).join('、');
                const dueClass = t.dueDate ? 'todo-due' : 'todo-due todo-due-none';
                const sessionCount = (t.sessions || []).length;

                return `
                    <tr>
                        <td><input type="checkbox" ${t.done ? 'checked' : ''} 
                            onchange="toggleTodo(${escapeJsArg(t.id)}); renderTodoTable();"></td>
                        <td class="todo-title-cell ${t.done ? 'is-done' : ''}" onclick="openTodoDetail(${escapeJsArg(t.id)})">
                            ${escapeHtml(t.text)}
                            ${t.subTodos && t.subTodos.length > 0 ? `<span style="color:#999; font-size:12px;">(${t.subTodos.filter(s=>s.done).length}/${t.subTodos.length})</span>` : ''}
                            <div class="todo-title-meta">${escapeHtml(getTodoPlanLabel(t))} · 执行 ${sessionCount} 次</div>
                        </td>
                        <td><span class="${dueClass}">${escapeHtml(formatTodoDueDate(t))}</span></td>
                        <td>${renderTodoUrgencyBadge(t)}</td>
                        <td><span class="tag tag-${toSafeClassName(t.group, 'todo-group')}">${escapeHtml(t.group)}</span></td>
                        <td>${t.isExclusive ? '专属' : '通用'}</td>
                        <td style="font-size:12px; color:#666;">${escapeHtml(recordNames || '无归属')}</td>
                    </tr>
                `;
            }).join('');
        }

        function openTodoModal() {
            currentTodoId = null;
            pendingIdeaTodoRecordId = '';
            document.getElementById('todo-detail-text').value = '';
            document.getElementById('todo-detail-note').value = '';
            document.getElementById('todo-detail-plan-start').value = '';
            document.getElementById('todo-detail-plan-end').value = '';
            document.getElementById('todo-detail-date').value = '';
            document.getElementById('todo-detail-urgency').value = 'medium';
            document.getElementById('todo-detail-group').value = '其他';
            tempSubTodos = [];
            tempTodoSessions = [];
            resetTodoSessionInputs();
            renderSubTodos();
            renderTodoSessions();
            renderTodoRecords();
            setTodoDetailMode('edit');
            document.getElementById('todo-detail-modal').classList.add('active');
        }

        function openTodoDetail(todoId) {
            currentTodoId = todoId;
            pendingIdeaTodoRecordId = '';
            const todo = data.todos.find(t => t.id === todoId);
            if (!todo) return;

            loadTodoDetailForm(todo);
            resetTodoSessionInputs();
            setTodoDetailMode('view');
            document.getElementById('todo-detail-modal').classList.add('active');
        }

        function closeTodoDetail() {
            document.getElementById('todo-detail-modal').classList.remove('active');
            currentTodoId = null;
            tempSubTodos = [];
            tempTodoSessions = [];
            currentTodoDetailMode = 'view';
            pendingIdeaTodoRecordId = '';
        }

        let tempSubTodos = [];
        let tempTodoSessions = [];
        let currentTodoDetailMode = 'view';
        let pendingIdeaTodoRecordId = '';

        function openIdeaTodoDraft(record) {
            currentTodoId = null;
            pendingIdeaTodoRecordId = record.id;
            document.getElementById('todo-detail-text').value = getIdeaTodoText(record);
            document.getElementById('todo-detail-note').value = getIdeaTodoNote(record);
            document.getElementById('todo-detail-plan-start').value = '';
            document.getElementById('todo-detail-plan-end').value = '';
            document.getElementById('todo-detail-date').value = '';
            document.getElementById('todo-detail-urgency').value = 'medium';
            document.getElementById('todo-detail-group').value = '学习';
            tempSubTodos = record.ideaNextAction && record.ideaNextAction !== getIdeaTodoText(record)
                ? [{ text: record.ideaNextAction, done: false }]
                : [];
            tempTodoSessions = [];
            resetTodoSessionInputs();
            setTodoDetailMode('edit');
            document.getElementById('todo-detail-modal').classList.add('active');
        }

        function loadTodoDetailForm(todo) {
            document.getElementById('todo-detail-text').value = todo.text || '';
            document.getElementById('todo-detail-note').value = todo.note || '';
            document.getElementById('todo-detail-plan-start').value = todo.planStartDate || '';
            document.getElementById('todo-detail-plan-end').value = todo.planEndDate || '';
            document.getElementById('todo-detail-date').value = todo.dueDate || '';
            document.getElementById('todo-detail-urgency').value = todo.urgency || 'medium';
            document.getElementById('todo-detail-group').value = todo.group || '其他';
            tempSubTodos = todo.subTodos ? JSON.parse(JSON.stringify(todo.subTodos)) : [];
            tempTodoSessions = todo.sessions ? JSON.parse(JSON.stringify(todo.sessions)) : [];
        }

        function renderTodoDetailView() {
            const container = document.getElementById('todo-detail-view');
            if (!container) return;
            const todo = currentTodoId ? data.todos.find(t => t.id === currentTodoId) : null;
            if (!todo) {
                container.innerHTML = '';
                return;
            }

            const subTotal = (todo.subTodos || []).length;
            const subDone = (todo.subTodos || []).filter(s => s.done).length;
            const sessionCount = (todo.sessions || []).length;
            const statusText = todo.done ? '已完成' : (isTodoOverdue(todo) ? `已超期 ${getTodoOverdueDays(todo)} 天` : '未完成');
            const meta = [
                getTodoPlanLabel(todo),
                `截止：${formatTodoDueDate(todo)}`,
                `分组：${todo.group || '其他'}`,
                `执行 ${sessionCount} 次`,
                subTotal ? `子任务 ${subDone}/${subTotal}` : '',
                statusText
            ].filter(Boolean);

            container.innerHTML = `
                <div class="todo-detail-card">
                    <h3>${escapeHtml(todo.text || '未命名待办')}</h3>
                    <div class="todo-detail-meta">
                        ${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
                        ${renderTodoUrgencyBadge(todo)}
                    </div>
                    ${todo.note ? `<div class="todo-detail-note">${escapeHtml(todo.note).replace(/\n/g, '<br>')}</div>` : ''}
                </div>
            `;
        }

        function setTodoDetailMode(mode) {
            currentTodoDetailMode = mode === 'edit' ? 'edit' : 'view';
            const todo = currentTodoId ? data.todos.find(t => t.id === currentTodoId) : null;
            if (currentTodoDetailMode === 'view' && todo) {
                loadTodoDetailForm(todo);
            }

            const isEdit = currentTodoDetailMode === 'edit';
            const isExisting = !!currentTodoId;
            document.getElementById('todo-detail-title').textContent = isEdit
                ? (isExisting ? '编辑待办' : (pendingIdeaTodoRecordId ? '灵感转待办' : '新建待办'))
                : '待办详情';
            document.getElementById('todo-detail-view').style.display = isEdit ? 'none' : '';
            document.getElementById('todo-detail-edit-panel').style.display = isEdit ? '' : 'none';
            document.getElementById('todo-session-editor').style.display = (isEdit && isExisting) ? '' : 'none';
            document.getElementById('todo-subtodo-add').style.display = isEdit ? '' : 'none';
            document.getElementById('todo-detail-view-actions').style.display = (!isEdit && isExisting) ? '' : 'none';
            document.getElementById('todo-detail-edit-actions').style.display = isEdit ? '' : 'none';
            document.querySelectorAll('#todo-detail-edit-actions .btn-danger, #todo-detail-view-actions .btn-danger')
                .forEach(btn => { btn.style.display = isExisting ? '' : 'none'; });
            const doneToggle = document.getElementById('todo-detail-done-toggle');
            if (doneToggle) doneToggle.textContent = todo?.done ? '恢复未完成' : '标记完成';

            renderTodoDetailView();
            renderSubTodos();
            renderTodoSessions();
            renderTodoRecords();
        }

        function resetTodoSessionInputs() {
            const now = new Date();
            const dateEl = document.getElementById('todo-session-date');
            const startEl = document.getElementById('todo-session-start');
            const endEl = document.getElementById('todo-session-end');
            const noteEl = document.getElementById('todo-session-note');
            if (dateEl) dateEl.value = getTodayStr();
            if (startEl) startEl.value = formatClockTime(now);
            if (endEl) endEl.value = '';
            if (noteEl) noteEl.value = '';
        }

        function applyTodoDatePreset(preset) {
            const planStartEl = document.getElementById('todo-detail-plan-start');
            const planEndEl = document.getElementById('todo-detail-plan-end');
            const dueEl = document.getElementById('todo-detail-date');
            if (!planStartEl || !planEndEl || !dueEl) return;

            const today = getTodayStr();
            if (preset === 'today') {
                planStartEl.value = today;
                planEndEl.value = today;
                dueEl.value = today;
                return;
            }
            if (preset === 'tomorrow') {
                const tomorrow = addDays(today, 1);
                planStartEl.value = tomorrow;
                planEndEl.value = tomorrow;
                dueEl.value = tomorrow;
                return;
            }
            if (preset === 'this-week') {
                const end = getWeekEnd(today);
                planStartEl.value = today;
                planEndEl.value = end;
                dueEl.value = end;
                return;
            }
            if (preset === 'next-week') {
                const start = addDays(getWeekStart(today), 7);
                const end = addDays(start, 6);
                planStartEl.value = start;
                planEndEl.value = end;
                dueEl.value = end;
                return;
            }
            if (preset === 'no-due') {
                // Floating pool requires no due date and no plan range.
                planStartEl.value = '';
                planEndEl.value = '';
                dueEl.value = '';
            }
        }

        function renderTodoSessions() {
            const container = document.getElementById('todo-detail-sessions');
            if (!container) return;
            if (!currentTodoId) {
                container.innerHTML = '<div class="todo-session-empty">保存待办后，才能记录具体执行时间。</div>';
                return;
            }
            if (tempTodoSessions.length === 0) {
                container.innerHTML = '<div class="todo-session-empty">还没有执行记录。做了一段就记一次，时间轴会按这里显示。</div>';
                return;
            }
            const sorted = [...tempTodoSessions].sort((a, b) => {
                const aValue = `${a.date || ''}T${a.startTime || '00:00'}`;
                const bValue = `${b.date || ''}T${b.startTime || '00:00'}`;
                return bValue.localeCompare(aValue);
            });
            container.innerHTML = sorted.map(session => `
                <div class="todo-session-item">
                    <div class="todo-session-main">
                        <strong>${escapeHtml(session.date || '未设日期')} ${escapeHtml(session.startTime || '')}${session.endTime ? ` - ${escapeHtml(session.endTime)}` : ''}</strong>
                        ${session.note ? `<span>${escapeHtml(session.note)}</span>` : '<span>执行了一次</span>'}
                    </div>
                    <button class="btn btn-secondary" onclick="deleteTodoSession(${escapeJsArg(session.id)})">删本次</button>
                </div>
            `).join('');
        }

        function addTodoSession() {
            if (!currentTodoId) {
                alert('请先保存待办，再记录执行时间');
                return;
            }
            const date = document.getElementById('todo-session-date').value || getTodayStr();
            const startTime = document.getElementById('todo-session-start').value || formatClockTime(new Date());
            const endTime = document.getElementById('todo-session-end').value;
            const note = document.getElementById('todo-session-note').value.trim();
            if (endTime && startTime && endTime <= startTime) {
                alert('结束时间需要晚于开始时间');
                return;
            }
            if (tempTodoSessions.some(session => session.date === date)) {
                alert('这个待办当天已经记录过一次执行了');
                return;
            }
            tempTodoSessions.push({
                id: genId(),
                date,
                startTime,
                endTime,
                note,
                createdAt: getLocalDateTimeStr()
            });
            const todo = data.todos.find(t => t.id === currentTodoId);
            if (todo) {
                todo.sessions = JSON.parse(JSON.stringify(tempTodoSessions));
                todo.updatedAt = getLocalDateTimeStr();
                saveData();
                renderTodoDetailView();
                renderDashboard();
                renderTodoTable();
                renderAllRecords();
            }
            resetTodoSessionInputs();
            renderTodoSessions();
        }

        function deleteTodoSession(sessionId) {
            if (!currentTodoId) return;
            if (!confirm('只删除这一次执行记录吗？待办本身会保留。')) return;
            tempTodoSessions = tempTodoSessions.filter(session => session.id !== sessionId);
            const todo = data.todos.find(t => t.id === currentTodoId);
            if (todo) {
                todo.sessions = JSON.parse(JSON.stringify(tempTodoSessions));
                todo.updatedAt = getLocalDateTimeStr();
                saveData();
                renderTodoDetailView();
                renderDashboard();
                renderTodoTable();
                renderAllRecords();
            }
            renderTodoSessions();
        }

        function renderSubTodos() {
            const container = document.getElementById('todo-detail-subtodos');
            if (!tempSubTodos.length) {
                container.innerHTML = `<div class="todo-session-empty">${currentTodoDetailMode === 'edit' ? '暂无子任务，可以在下方添加。' : '暂无子任务。'}</div>`;
                return;
            }
            const canEdit = currentTodoDetailMode === 'edit';
            container.innerHTML = tempSubTodos.map((s, i) => `
                <li class="todo-item todo-subtodo-item ${s.done ? 'done' : ''} ${canEdit ? 'is-editing' : 'is-viewing'}">
                    <input type="checkbox" ${s.done ? 'checked' : ''} onchange="${canEdit ? `tempSubTodos[${i}].done = this.checked; renderSubTodos();` : `toggleSubTodoFromDetail(${i}, this.checked)`}">
                    <span class="todo-text">${escapeHtml(s.text)}</span>
                    ${canEdit ? `<button class="btn btn-secondary todo-mini-btn" onclick="tempSubTodos.splice(${i},1); renderSubTodos();">删除</button>` : ''}
                </li>
            `).join('');
        }

        function syncTodoDoneFromSubTodos(todo, stamp = getLocalDateTimeStr()) {
            return todosService.syncDoneFromSubTodos(todo, stamp);
        }

        function toggleSubTodoFromDetail(index, checked) {
            if (!currentTodoId) return;
            const todo = data.todos.find(t => t.id === currentTodoId);
            if (!todo || !Array.isArray(todo.subTodos) || !todo.subTodos[index]) return;
            const stamp = getLocalDateTimeStr();
            todo.subTodos[index].done = !!checked;
            todo.updatedAt = stamp;
            syncTodoDoneFromSubTodos(todo, stamp);
            tempSubTodos = JSON.parse(JSON.stringify(todo.subTodos));
            saveData();
            renderTodoDetailView();
            renderSubTodos();
            renderDashboard();
            renderTodoTable();
            renderAllRecords();
        }

        function toggleCurrentTodoDoneFromDetail() {
            if (!currentTodoId) return;
            toggleTodo(currentTodoId);
            const todo = data.todos.find(t => t.id === currentTodoId);
            if (!todo) {
                closeTodoDetail();
                return;
            }
            loadTodoDetailForm(todo);
            setTodoDetailMode('view');
        }

        function addSubTodo() {
            const input = document.getElementById('new-subtodo-input');
            const text = input.value.trim();
            if (!text) return;
            tempSubTodos.push({ text: text, done: false });
            input.value = '';
            renderSubTodos();
        }

        function renderTodoRecords() {
            const container = document.getElementById('todo-detail-records');
            if (!currentTodoId) {
                container.innerHTML = '<div style="color:#999; font-size:12px;">新建待办保存后可查看关联记录</div>';
                return;
            }

            const recordIds = data.records.filter(r => r.todoIds?.includes(currentTodoId)).map(r => r.id);
            if (recordIds.length === 0) {
                container.innerHTML = '<div style="color:#999; font-size:12px;">暂无关联记录</div>';
                return;
            }

            container.innerHTML = recordIds.map(id => {
                const r = data.records.find(rr => rr.id === id);
                return `<div style="padding:4px 0; font-size:13px; cursor:pointer; color:#d48806;" 
                    onclick="closeTodoDetail(); openRecordPreview('${id}');">${r ? (r.title || r.type) : '记录'}</div>`;
            }).join('');
        }

        function saveTodoDetail() {
            const text = document.getElementById('todo-detail-text').value.trim();
            if (!text) {
                alert('请输入任务名称');
                return;
            }

            const normalizedRange = todosService.normalizeTodoDateRange(
                document.getElementById('todo-detail-plan-start').value,
                document.getElementById('todo-detail-plan-end').value
            );
            if (!normalizedRange.isValid) {
                alert('计划结束日期不能早于计划开始日期');
                return;
            }

            const todoData = {
                text: text,
                note: document.getElementById('todo-detail-note')?.value.trim() || '',
                planStartDate: normalizedRange.planStartDate,
                planEndDate: normalizedRange.planEndDate,
                dueDate: document.getElementById('todo-detail-date').value,
                urgency: document.getElementById('todo-detail-urgency').value || 'medium',
                group: document.getElementById('todo-detail-group').value,
                subTodos: tempSubTodos,
                sessions: tempTodoSessions,
                updatedAt: getLocalDateTimeStr(),
                isExclusive: false
            };

            if (currentTodoId) {
                const todo = data.todos.find(t => t.id === currentTodoId);
                if (todo) Object.assign(todo, todoData);
            } else {
                todoData.id = genId();
                todoData.done = false;
                todoData.createdAt = getLocalDateTimeStr();
                todoData.completedAt = '';
                data.todos.push(todoData);
            }

            // 自动计算主任务状态
            const target = currentTodoId 
                ? data.todos.find(t => t.id === currentTodoId) 
                : data.todos[data.todos.length - 1];
            syncTodoDoneFromSubTodos(target, getLocalDateTimeStr());

            if (pendingIdeaTodoRecordId && target) {
                const sourceIdea = data.records.find(record => record.id === pendingIdeaTodoRecordId && record.type === '灵感碎片');
                if (sourceIdea) {
                    sourceIdea.ideaTodoId = target.id;
                    sourceIdea.ideaNextAction = sourceIdea.ideaNextAction || target.text;
                    if (getIdeaStatus(sourceIdea) === '待整理') sourceIdea.ideaStatus = '待实践';
                    sourceIdea.updatedAt = getLocalDateTimeStr();
                }
            }

            saveData();
            const wasIdeaTodoDraft = !!pendingIdeaTodoRecordId;
            closeTodoDetail();
            renderTodoTable();
            if (wasIdeaTodoDraft) renderIdeaPool();
            renderDashboard();
            renderAllRecords();
            renderGlobalSearch();
            refreshKnowledgeViews();
        }

        function deleteCurrentTodo() {
            if (!currentTodoId) return;
            if (!confirm('确定删除这个待办吗？')) return;
            const deletedTodo = data.todos.find(t => t.id === currentTodoId);
            markDeletedItem('todos', currentTodoId, { reason: 'manual-delete', text: deletedTodo?.text || '' });
            
            data.todos = data.todos.filter(t => t.id !== currentTodoId);
            // 从所有记录中移除引用
            data.records.forEach(r => {
                if (r.todoIds) {
                    r.todoIds = r.todoIds.filter(id => id !== currentTodoId);
                }
                if (r.ideaTodoId === currentTodoId) {
                    r.ideaTodoId = '';
                    r.updatedAt = getLocalDateTimeStr();
                }
            });
            
            saveData();
            closeTodoDetail();
            renderTodoTable();
            renderDashboard();
            renderAllRecords();
        }
        // ================== 习惯打卡 ==================
        function setHabitView(view, button) {
            currentHabitView = view;
            document.querySelectorAll('#habit-view-tabs button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.habitView === view);
            });
            if (button) button.classList.add('active');
            ['today', 'makeup', 'library', 'wallet', 'analysis', 'diagnostics'].forEach(name => {
                const panel = document.getElementById(`habit-view-${name}`);
                if (panel) panel.classList.toggle('active', view === name);
            });
            updateHabitToolbarVisibility();
            renderHabitCurrentView();
        }

        function renderHabitPage() {
            if (!['today', 'makeup', 'library', 'wallet', 'analysis', 'diagnostics'].includes(currentHabitView)) currentHabitView = 'today';
            if (!currentHabitId && data.habits.length > 0) currentHabitId = data.habits[0].id;
            const tab = document.querySelector(`#habit-view-tabs button[data-habit-view="${currentHabitView}"]`);
            setHabitView(currentHabitView, tab);
            renderHabitKpis();
        }

        function renderHabitCurrentView() {
            renderHabitKpis();
            if (currentHabitView === 'today') renderHabitCenterToday();
            if (currentHabitView === 'makeup') renderHabitMakeupPanel();
            if (currentHabitView === 'library') renderHabitLibraryPanel();
            if (currentHabitView === 'wallet') renderHabitRewards();
            if (currentHabitView === 'analysis') {
                renderHabitTabs();
                if (currentHabitId) renderHeatmap();
                renderHabitMatrix();
            }
            if (currentHabitView === 'diagnostics') renderHabitDiagnosticsPanel();
        }

        function updateHabitToolbarVisibility() {
            const makeupDate = document.getElementById('habit-makeup-date');
            if (makeupDate) {
                if (!makeupDate.value) makeupDate.value = getTodayStr();
                makeupDate.style.display = currentHabitView === 'makeup' ? 'block' : 'none';
            }
            const matrixDays = document.getElementById('habit-matrix-days');
            if (matrixDays) matrixDays.style.display = currentHabitView === 'analysis' ? 'block' : 'none';
        }

        function getHabitDayStatus(habit, date) {
            const targetCount = getHabitTargetCount(habit);
            const doneCount = getCheckinCount(habit.id, date);
            return {
                targetCount,
                doneCount,
                isDone: doneCount >= targetCount,
                isStarted: doneCount > 0,
                due: isHabitDueOnDate(habit, date)
            };
        }

        function renderHabitKpis() {
            const container = document.getElementById('habit-kpi-grid');
            if (!container) return;
            const today = getTodayStr();
            const dueHabits = data.habits.filter(habit => isHabitDueOnDate(habit, today));
            const doneHabits = dueHabits.filter(habit => getCheckinCount(habit.id, today) >= getHabitTargetCount(habit));
            const partialHabits = dueHabits.filter(habit => {
                const count = getCheckinCount(habit.id, today);
                return count > 0 && count < getHabitTargetCount(habit);
            });
            const balances = getHabitPointBalances();
            const balanceText = Object.entries(balances)
                .sort(([a], [b]) => a.localeCompare(b, 'zh-Hans-CN'))
                .map(([currency, value]) => `${value} ${currency}`)
                .join(' · ') || `0 ${HABIT_DEFAULT_CURRENCY}`;
            const lastSevenDates = Array.from({ length: 7 }, (_, index) => addDays(today, -index));
            const recentCheckins = data.checkins.filter(item => lastSevenDates.includes(item.date)).length;
            const missedYesterday = data.habits.filter(habit => {
                const date = addDays(today, -1);
                return isHabitDueOnDate(habit, date) && getCheckinCount(habit.id, date) < getHabitTargetCount(habit);
            }).length;
            container.innerHTML = `
                <div class="habit-kpi-card"><span>今日达标</span><strong>${doneHabits.length}/${dueHabits.length}</strong><em>${partialHabits.length ? `${partialHabits.length} 条进行中` : '没有半途卡住'}</em></div>
                <div class="habit-kpi-card"><span>习惯库</span><strong>${data.habits.length}</strong><em>${dueHabits.length} 条今日应做</em></div>
                <div class="habit-kpi-card"><span>近 7 天打卡</span><strong>${recentCheckins}</strong><em>含多次打卡</em></div>
                <div class="habit-kpi-card"><span>昨日待处理</span><strong>${missedYesterday}</strong><em>可到补卡页审计</em></div>
                <div class="habit-kpi-card wide"><span>钱包余额</span><strong>${escapeHtml(balanceText)}</strong><em>当前仍来自旧 habitPointLedger</em></div>
            `;
        }

        function renderHabitCenterToday() {
            const container = document.getElementById('habit-center-today');
            if (!container) return;
            const today = getTodayStr();
            const todayHabits = data.habits.filter(h => isHabitDueOnDate(h, today));
            if (todayHabits.length === 0) {
                container.innerHTML = '<div class="empty-state" style="padding:18px 14px;">今日暂无安排的习惯</div>';
                return;
            }
            container.innerHTML = `<div class="habit-quick-list">${todayHabits.map(habit => renderHabitActionCard(habit, today, { compact: false })).join('')}</div>`;
        }

        function renderHabitActionCard(habit, date, { compact = false } = {}) {
            const status = getHabitDayStatus(habit, date);
            const latestCheckin = getLatestHabitCheckin(habit.id, date);
            const latestTime = latestCheckin ? getCheckinClockTime(latestCheckin) : '';
            const latestNote = getCheckinNoteSummary(latestCheckin?.note, 34);
            const statusClass = status.doneCount === 0 ? 'is-pending' : (status.isDone ? 'is-done' : 'is-active');
            const statusText = status.doneCount === 0
                ? '待开始'
                : (status.isDone ? '已达标' : `进行中 ${status.doneCount}/${status.targetCount}`);
            const rewardMeta = habit.randomReward
                ? (Math.max(0, parseInt(habit.rewardMin ?? habit.rewardPoints ?? 0, 10) || 0) > 0 || Math.max(0, parseInt(habit.rewardMax ?? habit.rewardPoints ?? 0, 10) || 0) > 0
                    ? { text: `+${habit.rewardMin ?? habit.rewardPoints ?? 0}-${habit.rewardMax ?? habit.rewardPoints ?? 0} ${normalizeHabitCurrency(habit.rewardCurrency)}`, className: 'is-points' }
                    : null)
                : (Math.max(0, parseInt(habit.rewardPoints ?? 0, 10) || 0) > 0
                    ? { text: `+${habit.rewardPoints} ${normalizeHabitCurrency(habit.rewardCurrency)}`, className: 'is-points' }
                    : null);
            const infoParts = [
                { text: getHabitRuleText(habit) },
                { text: `${status.doneCount}/${status.targetCount}` },
                { text: latestTime || '未记录' },
                rewardMeta,
                habit.penaltyPoints > 0 ? { text: `漏打 -${habit.penaltyPoints}`, className: 'is-penalty' } : null
            ].filter(Boolean);
            const noteModeArg = escapeJsArg(latestCheckin ? 'edit' : 'create');
            return `
                <article class="habit-quick-card ${compact ? 'compact' : ''} ${status.isStarted ? 'done' : ''} ${status.targetCount > 1 ? 'multi' : ''}">
                    <div class="habit-quick-head">
                        <div class="habit-quick-main">
                            <div class="habit-quick-title-row">
                                <div class="habit-quick-title">${escapeHtml(habit.name)}</div>
                                <span class="habit-quick-tag">${escapeHtml(habit.tag || '习惯')}</span>
                                <span class="habit-quick-status ${statusClass}">${escapeHtml(statusText)}</span>
                            </div>
                            <div class="habit-quick-meta">${infoParts.map(part => `<span class="${part.className || ''}">${escapeHtml(part.text)}</span>`).join('')}</div>
                            ${latestNote ? `<div class="habit-quick-note-inline">备注：${escapeHtml(latestNote)}</div>` : ''}
                        </div>
                        <div class="habit-quick-actions ${compact ? 'compact' : ''}">
                            <button class="habit-quick-btn primary" onclick="habitActionCheckin(${escapeJsArg(habit.id)}, ${escapeJsArg(date)})">${status.targetCount > 1 && status.doneCount > 0 ? '再记一次' : '打卡'}</button>
                            <button class="habit-quick-btn secondary" onclick="openHabitNoteModal({ habitId: ${escapeJsArg(habit.id)}, date: ${escapeJsArg(date)}, mode: ${noteModeArg} })">备注</button>
                            ${status.doneCount > 0 ? `<button class="habit-quick-btn ghost" onclick="habitActionDecrease(${escapeJsArg(habit.id)}, ${escapeJsArg(date)})">${status.targetCount === 1 ? '撤销' : '-1'}</button>` : ''}
                        </div>
                    </div>
                </article>
            `;
        }

        function habitActionCheckin(habitId, date) {
            const habit = data.habits.find(h => h.id === habitId);
            if (!habit) return;
            if (date === getTodayStr()) {
                quickHabitCheckin(habitId);
                return;
            }
            toggleCheckin(habitId, date);
            refreshHabitCheckinViews();
        }

        function habitActionDecrease(habitId, date) {
            const habit = data.habits.find(h => h.id === habitId);
            if (!habit) return;
            if (date === getTodayStr() && getHabitTargetCount(habit) === 1) {
                quickUndoHabitCheckin(habitId);
            } else {
                decreaseCheckin(habitId, date);
                refreshHabitCheckinViews();
            }
        }

        function renderHabitMakeupPanel() {
            const container = document.getElementById('habit-makeup-panel');
            if (!container) return;
            const dateInput = document.getElementById('habit-makeup-date');
            const date = dateInput?.value || getTodayStr();
            if (dateInput && !dateInput.value) dateInput.value = date;
            const dueHabits = data.habits.filter(habit => isHabitDueOnDate(habit, date));
            if (date > getTodayStr()) {
                container.innerHTML = '<div class="empty-state">不能补未来日期，换一个日期看看。</div>';
                return;
            }
            if (dueHabits.length === 0) {
                container.innerHTML = '<div class="empty-state">这一天没有按规则应完成的习惯。</div>';
                return;
            }
            container.innerHTML = `<div class="habit-quick-list">${dueHabits.map(habit => renderHabitActionCard(habit, date, { compact: true })).join('')}</div>`;
        }

        function renderHabitLibraryPanel() {
            const container = document.getElementById('habit-library-panel');
            if (!container) return;
            if (data.habits.length === 0) {
                container.innerHTML = '<div class="empty-state">暂无习惯，先新建一个习惯。</div>';
                return;
            }
            const today = getTodayStr();
            container.innerHTML = `
                <div class="habit-library-table">
                    <div class="habit-library-row head">
                        <span>名称</span><span>规则</span><span>今日</span><span>连续</span><span>最后操作</span><span>操作</span>
                    </div>
                    ${data.habits.map(habit => {
                        const status = getHabitDayStatus(habit, today);
                        const latest = [...data.checkins].filter(item => item.habitId === habit.id).sort((a, b) => (b.checkinAt || b.createdAt || '').localeCompare(a.checkinAt || a.createdAt || ''))[0];
                        const streak = getHabitStreakEndingOn(habit, today);
                        return `
                            <div class="habit-library-row">
                                <div class="habit-library-name"><strong>${escapeHtml(habit.name)}</strong><em>${escapeHtml(habit.tag || '习惯')}</em></div>
                                <span>${escapeHtml(getHabitRuleText(habit))} · ${status.targetCount}次/天</span>
                                <span>${status.doneCount}/${status.targetCount}</span>
                                <span>${streak} 天</span>
                                <span>${latest ? escapeHtml(formatStoredDateTime(latest.checkinAt || latest.createdAt || latest.date)) : '暂无'}</span>
                                <div class="habit-library-actions">
                                    <button class="btn btn-secondary" onclick="currentHabitId=${escapeJsArg(habit.id)}; editCurrentHabit();">编辑</button>
                                    <button class="btn btn-danger" onclick="currentHabitId=${escapeJsArg(habit.id)}; deleteCurrentHabit();">删除</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        function ensureHabitAppLocalMirrorForDiagnostics() {
            if (habitAppLocalMirror) return false;
            return !!rebuildHabitAppLocalMirror('diagnostics-auto-bootstrap');
        }

        function renderHabitRemotePreviewPanel() {
            const preview = habitRemotePreviewState || {};
            const statusLabels = {
                idle: '尚未检查',
                loading: '正在只读检查',
                missing: '云端文件不存在',
                ready: preview.hashesMatch ? '本地与云端一致' : '只读预检完成',
                error: '只读检查失败'
            };
            const statusClasses = {
                idle: 'is-prepared',
                loading: 'is-partial',
                missing: 'is-partial',
                ready: preview.hashesMatch ? 'is-ready' : 'is-prepared',
                error: 'is-blocked'
            };
            let body = '<div class="habit-remote-preview-empty">点击“手动检查云端”发起一次 GET；远端与合并结果只在当前页面展示。若本地镜像尚不存在，进入诊断页仍会按既有规则自动创建镜像。</div>';
            if (preview.status === 'loading') {
                body = '<div class="habit-remote-preview-empty is-loading">正在读取云端 habit-app 文件并计算合并预览…</div>';
            } else if (preview.status === 'missing') {
                body = `
                    <div class="habit-remote-preview-empty is-warning">
                        <strong>云端尚无 habit-app 文件</strong>
                        <span>${escapeHtml(preview.remotePath || '/apps/habit-app/data.json')} 返回 404 或空内容。本次没有创建文件，也没有自动上传本地镜像。</span>
                    </div>
                `;
            } else if (preview.status === 'error') {
                body = `
                    <div class="habit-remote-preview-empty is-danger">
                        <strong>无法完成只读预检</strong>
                        <span>${escapeHtml(preview.error || '未知错误')}</span>
                    </div>
                `;
            } else if (preview.status === 'ready' && preview.local && preview.remote && preview.merged) {
                const rows = [
                    ['本地镜像', preview.local],
                    ['云端文件', preview.remote],
                    ['合并预览', preview.merged]
                ];
                body = `
                    <div class="habit-remote-preview-table-wrap">
                        <table class="habit-remote-preview-table">
                            <thead>
                                <tr><th>来源</th><th>Hash</th><th>Habits</th><th>Records</th><th>Ledger</th><th>Tombstone</th><th>钱包余额</th></tr>
                            </thead>
                            <tbody>
                                ${rows.map(([label, item]) => `
                                    <tr>
                                        <th>${escapeHtml(label)}</th>
                                        <td><code>${escapeHtml(item.hashShort || '无')}</code></td>
                                        <td>${escapeHtml(item.counts.habits)}</td>
                                        <td>${escapeHtml(item.counts.records)}</td>
                                        <td>${escapeHtml(item.counts.ledger)}</td>
                                        <td>${escapeHtml(item.counts.tombstones)}</td>
                                        <td>${escapeHtml(item.balanceText)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="habit-remote-preview-verdict">
                        <strong>${preview.hashesMatch ? '本地镜像与云端 hash 一致' : '本地与云端存在差异，已生成合并预览'}</strong>
                        <span>merged hash ${escapeHtml(preview.merged.hashShort || '无')} · ${escapeHtml(preview.mode === 'merge' ? '手动合并预检' : '手动云端检查')} · 全程未保存</span>
                    </div>
                    ${(preview.risks || []).length ? `
                        <div class="habit-remote-risk-list">
                            ${(preview.risks || []).map(item => `
                                <div class="habit-remote-risk is-${escapeHtml(item.severity || 'info')}">
                                    <strong>${escapeHtml(item.title || '预检提示')}</strong>
                                    <span>${escapeHtml(item.detail || '')}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="habit-remote-preview-ok">未发现 schema、数量、tombstone 或钱包流水风险。</div>'}
                `;
            }
            return `
                <div class="habit-remote-preview" aria-live="polite" aria-busy="${preview.status === 'loading' ? 'true' : 'false'}">
                    <div class="habit-remote-preview-head">
                        <div>
                            <strong>云端只读预检</strong>
                            <span>GET ${escapeHtml(preview.remotePath || habitSyncConfig.remotePath || '/apps/habit-app/data.json')} · GET 结果不写 lifePlanData / habitAppData · 不发 PUT</span>
                        </div>
                        <span class="habit-dualwrite-status ${statusClasses[preview.status] || 'is-prepared'}">${escapeHtml(statusLabels[preview.status] || statusLabels.idle)}</span>
                    </div>
                    ${body}
                </div>
            `;
        }

        function renderHabitDiagnosticsPanel() {
            const container = document.getElementById('habit-diagnostics-panel');
            if (!container) return;
            ensureHabitAppLocalMirrorForDiagnostics();
            const diagnostics = habitService.buildLegacyHabitDiagnostics(data);
            const readiness = habitService.buildHabitDualWriteReadiness(data, diagnostics);
            const snapshotPreview = habitService.buildHabitAppSnapshotPreview(data);
            const snapshotSourceHash = getHabitLegacySourceHash();
            const consistency = habitService.buildHabitDualWriteConsistency(data, habitAppLocalMirror, snapshotSourceHash);
            const mirrorSummary = consistency.mirror || getHabitAppLocalMirrorSummary();
            const summary = diagnostics.summary || {};
            const readinessSummary = readiness.summary || {};
            const snapshotSummary = snapshotPreview.summary || {};
            const balances = (summary.walletBalances || [])
                .map(item => `${item.amount} ${item.currency}`)
                .join(' · ') || `0 ${HABIT_DEFAULT_CURRENCY}`;
            const metrics = [
                { label: '旧习惯', value: summary.habits || 0, note: 'data.habits' },
                { label: '旧打卡', value: summary.checkins || 0, note: 'data.checkins' },
                { label: '钱包流水', value: summary.habitPointLedger || 0, note: 'habitPointLedger' },
                { label: '心愿', value: summary.habitRewards || 0, note: 'habitRewards' },
                { label: '今日达标', value: `${summary.doneToday || 0}/${summary.dueToday || 0}`, note: `${summary.partialToday || 0} 条进行中` },
                { label: '近 7 天打卡', value: summary.recentCheckins || 0, note: '含多次记录' },
                { label: '全部 Tombstone', value: summary.deletedItems || 0, note: `其中习惯 ${summary.deletedHabitItems || 0} · 打卡 ${summary.deletedCheckinItems || 0}` },
                { label: '钱包预览', value: balances, note: '仅按旧流水汇总' }
            ];
            const issueLevelRank = { danger: 0, warning: 1, info: 2 };
            const issues = [...(diagnostics.issues || [])].sort((a, b) => (issueLevelRank[a.severity] ?? 3) - (issueLevelRank[b.severity] ?? 3));
            const readinessStatusClass = readiness.status === 'blocked'
                ? 'is-blocked'
                : (readiness.status === 'ready'
                    ? 'is-ready'
                    : (readiness.status === 'partial' ? 'is-partial' : 'is-prepared'));
            const mirrorStatusLabel = consistency.statusLabel || (!mirrorSummary.exists
                ? '尚未生成本地镜像'
                : (mirrorSummary.matchesSource ? '本地镜像已对齐旧数据' : '本地镜像落后于旧数据'));
            const mirrorStatusClass = consistency.status === 'matched'
                ? 'is-ready'
                : (consistency.status === 'missing' ? 'is-blocked' : 'is-prepared');
            const mirrorMeta = mirrorSummary.exists
                ? `localStorage.habitAppData · 指纹 ${escapeHtml(mirrorSummary.sourceHashShort || '无')} · ${escapeHtml(mirrorSummary.summary.habits || 0)} habits · ${escapeHtml(mirrorSummary.summary.habitRecords || 0)} records · ${escapeHtml(mirrorSummary.summary.habitLedger || 0)} ledger`
                : '仅本地重建，不上传 /apps/habit-app/data.json';

            container.innerHTML = `
                <div class="habit-diagnostics-guard">
                    <div>
                        <strong>诊断页默认只读；本地镜像重建只写 localStorage.habitAppData，不上传云端。</strong>
                        <span>当前权威仍是 ${escapeHtml(diagnostics.authority || 'lifePlanData')}；这里先检查迁移/同步前的历史数据风险，并展示 Phase 4 本地双写前置状态。</span>
                    </div>
                    <span class="habit-diagnostics-pill">Phase 4 Readiness</span>
                </div>
                <div class="habit-diagnostics-grid">
                    ${metrics.map(item => renderHabitDiagnosticsMetric(item)).join('')}
                </div>
                <div class="habit-diagnostics-layout">
                    <section class="habit-diagnostics-card">
                        <div class="habit-shop-title">风险检查</div>
                        ${issues.length ? `
                            <div class="habit-diagnostics-issue-list">
                                ${issues.map(renderHabitDiagnosticsIssue).join('')}
                            </div>
                        ` : '<div class="habit-diagnostics-ok">当前没有发现重复 ID、孤儿引用、异常金额或未来打卡。</div>'}
                    </section>
                    <section class="habit-diagnostics-card">
                        <div class="habit-shop-title">habit-app 映射预览</div>
                        <div class="habit-mapping-list">
                            ${(diagnostics.mappingPreview || []).map(renderHabitMappingPreviewRow).join('')}
                        </div>
                    </section>
                    <section class="habit-diagnostics-card habit-dualwrite-card">
                        <div class="habit-snapshot-head">
                            <div>
                                <div class="habit-shop-title">本地双写前置</div>
                                <div class="habit-snapshot-meta">远端上传关闭 · 已接入 ${escapeHtml(readinessSummary.writePathEnabled || 0)}/${escapeHtml(readinessSummary.writePathTotal || 0)} 写路径 · 阻塞 ${escapeHtml(readinessSummary.blockerCount || 0)}</div>
                            </div>
                            <span class="habit-dualwrite-status ${readinessStatusClass}">${escapeHtml(readiness.statusLabel || readiness.status || 'unknown')}</span>
                        </div>
                        ${(readiness.blockers || []).length ? `
                            <div class="habit-diagnostics-issue-list">
                                ${(readiness.blockers || []).map(renderHabitDualWriteBlocker).join('')}
                            </div>
                        ` : '<div class="habit-diagnostics-ok">没有高风险阻塞项；可以开始按写路径清单做本地双写。</div>'}
                        <div class="habit-dualwrite-path-list">
                            ${(readiness.writePaths || []).map(renderHabitDualWritePathRow).join('')}
                        </div>
                        <div class="habit-dualwrite-next">
                            ${(readiness.nextActions || []).map(item => `<div>${escapeHtml(item)}</div>`).join('')}
                        </div>
                    </section>
                    <section class="habit-diagnostics-card habit-local-mirror-card">
                        <div class="habit-snapshot-head">
                            <div>
                                <div class="habit-shop-title">本地 habit-app 镜像</div>
                                <div class="habit-snapshot-meta">${mirrorMeta}</div>
                            </div>
                            <span class="habit-dualwrite-status ${mirrorStatusClass}">${escapeHtml(mirrorStatusLabel)}</span>
                        </div>
                        ${(() => {
                            const scaffold = getHabitSyncScaffoldSummary();
                            return `
                                <div class="habit-sync-scaffold">
                                    <div class="habit-snapshot-head">
                                        <div>
                                            <div class="habit-shop-title">habit 独立同步预检</div>
                                            <div class="habit-snapshot-meta">path ${escapeHtml(scaffold.remotePath)} · autoSync ${scaffold.autoSync ? 'on' : 'off'} · upload ${scaffold.remoteUploadEnabled ? 'on' : 'off'}</div>
                                        </div>
                                        <span class="habit-dualwrite-status is-prepared">${escapeHtml(scaffold.statusLabel)}</span>
                                    </div>
                                    <div class="habit-dualwrite-next">
                                        <div>配置键：habitAppSyncConfig / habitAppSyncState</div>
                                        <div>统一中转地址：${scaffold.endpointConfigured ? '已配置' : '未配置'}</div>
                                        <div>旧数据 hash：${escapeHtml(scaffold.lastLocalHashShort || '无')}</div>
                                        <div>镜像 hash：${escapeHtml(scaffold.mirrorHashShort || '无')}</div>
                                        <div>merge/hash 能力：${scaffold.mergeReady && scaffold.hashReady ? '已接入 sync-service' : '未就绪'}</div>
                                        <div>上次远端同步：${escapeHtml(scaffold.lastSyncAt || '尚未启用')}</div>
                                        <div>当前阶段：只允许手动 GET 预检；不会覆盖本地数据，也不会上传。</div>
                                    </div>
                                    <div class="habit-sync-actions">
                                        <button type="button" class="btn btn-secondary" ${isHabitRemotePreviewRunning ? 'disabled' : ''} onclick="runHabitManualSyncSkeleton('pull')">${isHabitRemotePreviewRunning ? '正在检查…' : '手动检查云端'}</button>
                                        <button type="button" class="btn btn-secondary" ${isHabitRemotePreviewRunning ? 'disabled' : ''} onclick="runHabitManualSyncSkeleton('both')">手动合并预检</button>
                                        <button type="button" class="btn btn-danger" ${scaffold.manualPushEnabled ? '' : 'disabled'} onclick="runHabitManualSyncSkeleton('push')">手动上传 habit-app（未开启）</button>
                                        <span>上传保持关闭；本阶段只会读取云端文件。</span>
                                    </div>
                                    ${renderHabitRemotePreviewPanel()}
                                </div>
                            `;
                        })()}
                        <div class="habit-local-mirror-actions">
                            <button type="button" class="btn btn-secondary" onclick="rebuildHabitAppLocalMirrorFromDiagnostics()">从当前旧数据重建本地镜像</button>
                            <span>不会触达 Worker / WebDAV，也不会修改 lifePlanData。</span>
                        </div>
                        <div class="habit-consistency-grid">
                            ${(consistency.comparisons || []).map(renderHabitConsistencyRow).join('')}
                        </div>
                        ${(consistency.balances || []).length ? `
                            <div class="habit-consistency-balance-list">
                                ${(consistency.balances || []).map(renderHabitConsistencyBalanceRow).join('')}
                            </div>
                        ` : '<div class="habit-diagnostics-ok">当前没有钱包余额可对比。</div>'}
                        ${(consistency.mismatches || []).length ? `
                            <div class="habit-diagnostics-issue-list">
                                ${(consistency.mismatches || []).map(item => `
                                    <article class="habit-diagnostics-issue is-warning">
                                        <div class="habit-diagnostics-issue-head">
                                            <strong>${escapeHtml(item)}</strong>
                                            <span>不一致</span>
                                        </div>
                                    </article>
                                `).join('')}
                            </div>
                        ` : '<div class="habit-diagnostics-ok">数量、余额与 sourceHash 当前一致。</div>'}
                        <div class="habit-dualwrite-next">
                            <div>上次重建：${escapeHtml(mirrorSummary.rebuiltAt || habitAppLocalMirrorMeta.lastRebuildAt || '尚未重建')}</div>
                            <div>原因：${escapeHtml(mirrorSummary.reason || habitAppLocalMirrorMeta.lastRebuildReason || '无')}</div>
                            <div>当前旧数据指纹：${escapeHtml(snapshotSourceHash.slice(0, 12))}</div>
                            ${habitAppLocalMirrorMeta.lastError ? `<div>最近错误：${escapeHtml(habitAppLocalMirrorMeta.lastError)}</div>` : ''}
                        </div>
                    </section>
                    <section class="habit-diagnostics-card habit-snapshot-preview-card">
                        <div class="habit-snapshot-head">
                            <div>
                                <div class="habit-shop-title">habit-app JSON 预览</div>
                                <div class="habit-snapshot-meta">只读输出 · 预览指纹 ${escapeHtml(snapshotSourceHash.slice(0, 12))} · ${escapeHtml(snapshotSummary.habits || 0)} habits · ${escapeHtml(snapshotSummary.habitRecords || 0)} records · ${escapeHtml(snapshotSummary.habitLedger || 0)} ledger</div>
                            </div>
                            <span>Phase 3 Preview</span>
                        </div>
                        <textarea id="habit-snapshot-preview-json" class="habit-snapshot-preview" readonly spellcheck="false">${escapeHtml(snapshotPreview.jsonText || '')}</textarea>
                    </section>
                </div>
            `;
        }

        function rebuildHabitAppLocalMirrorFromDiagnostics() {
            const built = rebuildHabitAppLocalMirror('diagnostics-manual-rebuild', { renderDiagnostics: true });
            if (!built) {
                alert('本地 habit-app 镜像重建失败，请检查浏览器本地存储权限。');
                return;
            }
            alert(`已重建本地镜像：${built.summary.habits || 0} habits · ${built.summary.habitRecords || 0} records · ${built.summary.habitLedger || 0} ledger`);
        }

        function renderHabitDiagnosticsMetric(item) {
            return `
                <div class="habit-diagnostics-metric">
                    <span>${escapeHtml(item.label)}</span>
                    <strong>${escapeHtml(item.value)}</strong>
                    <em>${escapeHtml(item.note || '')}</em>
                </div>
            `;
        }

        function renderHabitDiagnosticsIssue(issue) {
            const severity = ['danger', 'warning', 'info'].includes(issue.severity) ? issue.severity : 'info';
            const details = (issue.details || []).map(renderHabitDiagnosticsIssueDetail).join('');
            return `
                <article class="habit-diagnostics-issue is-${severity}">
                    <div class="habit-diagnostics-issue-head">
                        <strong>${escapeHtml(issue.label)}</strong>
                        <span>${escapeHtml(issue.count || 0)} 项</span>
                    </div>
                    ${issue.hint ? `<p>${escapeHtml(issue.hint)}</p>` : ''}
                    ${details ? `<div class="habit-diagnostics-detail-list">${details}</div>` : ''}
                    ${issue.hiddenCount > 0 ? `<div class="habit-diagnostics-more">还有 ${escapeHtml(issue.hiddenCount)} 项未展开</div>` : ''}
                </article>
            `;
        }

        function renderHabitDiagnosticsIssueDetail(detail) {
            const parts = Object.entries(detail || {})
                .filter(([, value]) => value !== undefined && value !== null && value !== '')
                .map(([key, value]) => `<span><b>${escapeHtml(key)}</b>${escapeHtml(value)}</span>`)
                .join('');
            return `<div class="habit-diagnostics-detail">${parts || '<span>无详细字段</span>'}</div>`;
        }

        function renderHabitMappingPreviewRow(item) {
            return `
                <div class="habit-mapping-row">
                    <div>
                        <strong>${escapeHtml(item.legacy)}</strong>
                        <span>${escapeHtml(item.note || '')}</span>
                    </div>
                    <div class="habit-mapping-target">
                        <em>${escapeHtml(item.target)}</em>
                        <b>${escapeHtml(item.count || 0)}</b>
                    </div>
                </div>
            `;
        }

        function renderHabitDualWriteBlocker(item) {
            const details = (item.details || [])
                .map(detail => `<span>${escapeHtml(detail)}</span>`)
                .join('');
            return `
                <article class="habit-diagnostics-issue is-warning">
                    <div class="habit-diagnostics-issue-head">
                        <strong>${escapeHtml(item.label || '阻塞项')}</strong>
                        <span>${escapeHtml(item.count || 0)} 项</span>
                    </div>
                    ${item.hint ? `<p>${escapeHtml(item.hint)}</p>` : ''}
                    ${details ? `<div class="habit-diagnostics-detail-list"><div class="habit-diagnostics-detail">${details}</div></div>` : ''}
                </article>
            `;
        }

        function renderHabitDualWritePathRow(item) {
            const status = item.dualWrite === 'enabled' ? 'enabled' : 'pending';
            const statusLabel = status === 'enabled' ? '已接入' : '待接入';
            const targets = [
                ...(item.legacyTargets || []).map(target => `旧 ${target}`),
                ...(item.snapshotTargets || []).map(target => `新 ${target}`)
            ].join(' · ');
            return `
                <div class="habit-dualwrite-path-row is-${status}">
                    <div>
                        <strong>P${escapeHtml(item.priority || '-')} · ${escapeHtml(item.label || item.fn || '写路径')}</strong>
                        <span>${escapeHtml(item.note || '')}</span>
                        <em>${escapeHtml(targets)}</em>
                    </div>
                    <b>${escapeHtml(statusLabel)}</b>
                </div>
            `;
        }

        function renderHabitConsistencyRow(item) {
            const matched = !!item.matched;
            return `
                <div class="habit-consistency-row ${matched ? 'is-matched' : 'is-drifted'}">
                    <strong>${escapeHtml(item.label || item.id || '对比项')}</strong>
                    <span>旧 ${escapeHtml(item.legacy || 0)}</span>
                    <span>镜像 ${escapeHtml(item.mirror || 0)}</span>
                    <b>${matched ? '一致' : `差 ${escapeHtml(item.delta || 0)}`}</b>
                </div>
            `;
        }

        function renderHabitConsistencyBalanceRow(item) {
            const matched = !!item.matched;
            return `
                <div class="habit-consistency-balance-row ${matched ? 'is-matched' : 'is-drifted'}">
                    <strong>${escapeHtml(item.currency || HABIT_DEFAULT_CURRENCY)}</strong>
                    <span>旧 ${escapeHtml(item.legacy || 0)}</span>
                    <span>镜像 ${escapeHtml(item.mirror || 0)}</span>
                    <b>${matched ? '余额一致' : `差 ${escapeHtml(item.delta || 0)}`}</b>
                </div>
            `;
        }

        function renderHabitMatrix() {
            const container = document.getElementById('habit-matrix');
            const days = parseInt(document.getElementById('habit-matrix-days')?.value || '30');
            if (data.habits.length === 0) {
                container.innerHTML = '<div class="empty-state">暂无习惯，先新建一个习惯</div>';
                return;
            }

            const dates = [];
            const today = getTodayStr();
            for (let i = days - 1; i >= 0; i--) dates.push(addDays(today, -i));

            container.innerHTML = `
                <div class="habit-matrix-grid" style="grid-template-columns: 160px repeat(${dates.length}, minmax(28px, 36px)); width: max-content; min-width: 100%;">
                    <div class="habit-matrix-cell name" title="习惯">习惯</div>
                    ${dates.map(date => `<div class="habit-matrix-cell head" title="${date}">${parseLocalDate(date).getDate()}</div>`).join('')}
                    ${data.habits.map(habit => `
                        <div class="habit-matrix-cell name" title="${escapeHtml(habit.name)}">${escapeHtml(habit.name)}</div>
                        ${dates.map(date => {
                            const count = getCheckinCount(habit.id, date);
                            return `<div class="habit-matrix-cell" title="${escapeHtml(habit.name)} · ${date} · ${count}次">
                                <span class="habit-dot ${count > 0 ? 'done' : ''}"></span>
                            </div>`;
                        }).join('')}
                    `).join('')}
                </div>
            `;
        }

        function renderHabitTabs() {
            const container = document.getElementById('habit-tabs');
            if (data.habits.length === 0) {
                container.innerHTML = '<div style="color:#999; font-size:13px;">暂无习惯，点击右上角新建</div>';
                return;
            }

            container.innerHTML = data.habits.map(h => `
                <div class="habit-tab tag-${toSafeClassName(h.tag, 'habit-tag')} ${currentHabitId === h.id ? 'active' : ''}"
                    onclick="currentHabitId=${escapeJsArg(h.id)}; renderHeatmap(); renderHabitTabs(); if(currentHabitView === 'analysis') renderHabitMatrix();">
                    ${escapeHtml(h.name)}
                </div>
            `).join('');
            container.style.display = currentHabitView === 'analysis' ? 'flex' : 'none';
        }

        function renderHabitRewards() {
            const panel = document.getElementById('habit-rewards-panel');
            if (!panel) return;
            const balances = getHabitPointBalances();
            const balanceChips = Object.entries(balances)
                .sort(([a], [b]) => a.localeCompare(b, 'zh-Hans-CN'))
                .map(([currency, value]) => `<span class="habit-balance-chip"><b>${value}</b>${escapeHtml(currency)}</span>`)
                .join('');
            const earned = summarizeHabitLedgerByCurrency(entry => entry.amount > 0);
            const spent = summarizeHabitLedgerByCurrency(entry => entry.amount < 0 && entry.type === 'redeem', true);
            const latestEntries = [...data.habitPointLedger]
                .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                .slice(0, 6);
            const rewards = [...data.habitRewards]
                .sort((a, b) => normalizeHabitCurrency(a.currency).localeCompare(normalizeHabitCurrency(b.currency), 'zh-Hans-CN') || (a.cost || 0) - (b.cost || 0));

            panel.innerHTML = `
                <div class="habit-wallet-card">
                    <div>
                        <div class="habit-wallet-label">钱包余额</div>
                        <div class="habit-balance-list">${balanceChips}</div>
                    </div>
                    <div class="habit-wallet-stats">
                        <span>累计获得 ${escapeHtml(earned || '0 金币')}</span>
                        <span>已兑换 ${escapeHtml(spent || '0 金币')}</span>
                    </div>
                    <div class="habit-wallet-actions">
                        <button class="btn btn-secondary" onclick="settleYesterdayHabitPenalties()">结算昨日扣分</button>
                        <button class="btn btn-secondary" onclick="openHabitRewardModal()">新增心愿</button>
                    </div>
                </div>
                <div class="habit-shop-grid">
                    <section class="habit-shop-section">
                        <div class="habit-shop-title">心愿兑换</div>
                        <div class="habit-reward-list">
                            ${rewards.length ? rewards.map(reward => renderHabitRewardCard(reward, balances)).join('') : '<div class="empty-state">还没有心愿，先添加一个能让你真的想兑换的奖励</div>'}
                        </div>
                    </section>
                    <section class="habit-shop-section">
                        <div class="habit-shop-title">近期流水</div>
                        <div class="habit-ledger-list">
                            ${latestEntries.length ? latestEntries.map(renderHabitLedgerRow).join('') : '<div class="empty-state">暂无积分流水</div>'}
                        </div>
                    </section>
                </div>
            `;
        }

        function renderHabitRewardCard(reward, balances) {
            const currency = normalizeHabitCurrency(reward.currency);
            const balance = balances[currency] || 0;
            const stockLeft = reward.stock > 0 ? Math.max(0, reward.stock - (reward.redeemedCount || 0)) : Infinity;
            const disabled = balance < reward.cost || stockLeft <= 0;
            return `
                <article class="habit-reward-card">
                    <div class="habit-reward-main">
                        <strong>${escapeHtml(reward.name)}</strong>
                        <span>${reward.stock > 0 ? `剩余 ${stockLeft}` : '不限次数'} · 已兑 ${reward.redeemedCount || 0} · ${escapeHtml(currency)}</span>
                        ${reward.note ? `<p>${escapeHtml(getCheckinNoteSummary(reward.note, 34))}</p>` : ''}
                    </div>
                    <button class="habit-redeem-btn" ${disabled ? 'disabled' : ''} onclick="redeemHabitReward(${escapeJsArg(reward.id)})">${escapeHtml(formatHabitCurrencyAmount(reward.cost, currency))}</button>
                </article>
            `;
        }

        function renderHabitLedgerRow(entry) {
            const habit = entry.habitId ? data.habits.find(item => item.id === entry.habitId) : null;
            const reward = entry.rewardId ? data.habitRewards.find(item => item.id === entry.rewardId) : null;
            const title = entry.note || habit?.name || reward?.name || '积分调整';
            return `
                <div class="habit-ledger-row ${entry.amount >= 0 ? 'is-plus' : 'is-minus'}">
                    <div>
                        <strong>${escapeHtml(title)}</strong>
                        <span>${formatStoredDateTime(entry.createdAt || entry.date || '')}</span>
                    </div>
                    <b>${entry.amount > 0 ? '+' : ''}${formatHabitCurrencyAmount(entry.amount, entry.currency)}</b>
                </div>
            `;
        }

        function openHabitRewardModal() {
            document.getElementById('habit-reward-name').value = '';
            document.getElementById('habit-reward-cost').value = '10';
            document.getElementById('habit-reward-currency-cost').value = HABIT_DEFAULT_CURRENCY;
            document.getElementById('habit-reward-stock').value = '0';
            document.getElementById('habit-reward-note').value = '';
            document.getElementById('habit-reward-modal').classList.add('active');
        }

        function closeHabitRewardModal() {
            document.getElementById('habit-reward-modal').classList.remove('active');
            const nameEl = document.getElementById('habit-reward-name');
            const costEl = document.getElementById('habit-reward-cost');
            const stockEl = document.getElementById('habit-reward-stock');
            const noteEl = document.getElementById('habit-reward-note');
            if (nameEl) nameEl.value = '';
            if (costEl) costEl.value = '10';
            if (stockEl) stockEl.value = '0';
            if (noteEl) noteEl.value = '';
        }

        function saveHabitReward() {
            const name = document.getElementById('habit-reward-name').value.trim();
            if (!name) {
                alert('请输入心愿名称');
                return;
            }
            const currency = ensureHabitCurrency(document.getElementById('habit-reward-currency-cost').value);
            const now = getLocalDateTimeStr();
            data.habitRewards.push({
                id: genId(),
                name,
                cost: Math.max(1, parseInt(document.getElementById('habit-reward-cost').value || '10', 10) || 10),
                currency,
                stock: Math.max(0, parseInt(document.getElementById('habit-reward-stock').value || '0', 10) || 0),
                redeemedCount: 0,
                note: document.getElementById('habit-reward-note').value.trim(),
                createdAt: now,
                updatedAt: now
            });
            saveData();
            dualWriteHabitAppLocalMirror('save-reward');
            closeHabitRewardModal();
            renderHabitCurrencyOptions();
            renderHabitRewards();
        }

        function redeemHabitReward(rewardId) {
            const reward = data.habitRewards.find(item => item.id === rewardId);
            if (!reward) return;
            const currency = normalizeHabitCurrency(reward.currency);
            const stockLeft = reward.stock > 0 ? Math.max(0, reward.stock - (reward.redeemedCount || 0)) : Infinity;
            if (stockLeft <= 0) {
                alert('这个心愿已经没有库存了');
                return;
            }
            if (getHabitPointBalance(currency) < reward.cost) {
                alert(`${currency} 不够，先攒一点再兑换`);
                return;
            }
            if (!confirm(`确认兑换「${reward.name}」吗？将扣除 ${formatHabitCurrencyAmount(reward.cost, currency)}。`)) return;
            reward.redeemedCount = (reward.redeemedCount || 0) + 1;
            reward.updatedAt = getLocalDateTimeStr();
            addHabitPointEntry({
                amount: -reward.cost,
                currency,
                type: 'redeem',
                rewardId: reward.id,
                note: `兑换「${reward.name}」`
            });
            saveData();
            dualWriteHabitAppLocalMirror('redeem-reward');
            renderHabitRewards();
            renderHabitKpis();
        }

        function openHabitPointAdjustModal() {
            document.getElementById('habit-point-adjust-type').value = 'add';
            document.getElementById('habit-point-adjust-amount').value = '1';
            document.getElementById('habit-point-adjust-currency').value = HABIT_DEFAULT_CURRENCY;
            document.getElementById('habit-point-adjust-note').value = '';
            document.getElementById('habit-point-adjust-modal').classList.add('active');
        }

        function closeHabitPointAdjustModal() {
            document.getElementById('habit-point-adjust-modal').classList.remove('active');
            const typeEl = document.getElementById('habit-point-adjust-type');
            const amountEl = document.getElementById('habit-point-adjust-amount');
            const noteEl = document.getElementById('habit-point-adjust-note');
            if (typeEl) typeEl.value = 'add';
            if (amountEl) amountEl.value = '1';
            if (noteEl) noteEl.value = '';
        }

        function saveHabitPointAdjust() {
            const type = document.getElementById('habit-point-adjust-type').value;
            const amount = Math.max(1, parseInt(document.getElementById('habit-point-adjust-amount').value || '1', 10) || 1);
            const currency = ensureHabitCurrency(document.getElementById('habit-point-adjust-currency').value);
            const note = document.getElementById('habit-point-adjust-note').value.trim() || (type === 'add' ? `手动增加${currency}` : `手动扣除${currency}`);
            addHabitPointEntry({
                amount: type === 'add' ? amount : -amount,
                currency,
                type: 'adjust',
                note
            });
            saveData();
            dualWriteHabitAppLocalMirror('adjust-points');
            closeHabitPointAdjustModal();
            renderHabitCurrencyOptions();
            renderHabitRewards();
            renderTodayHabits();
        }

        function initYearSelect() {
            const select = document.getElementById('year-select');
            const currentYear = new Date().getFullYear();
            let options = '';
            for (let y = currentYear + 1; y >= currentYear - 5; y--) {
                options += `<option value="${y}">${y}年</option>`;
            }
            select.innerHTML = options;
            select.value = currentYear;
        }

        function getCheckinCount(habitId, date) {
            return data.checkins.filter(c => c.habitId === habitId && c.date === date).length;
        }

        function getHabitCheckinsOnDate(habitId, date) {
            return data.checkins
                .filter(c => c.habitId === habitId && c.date === date)
                .sort((a, b) => {
                    const aValue = a.checkinAt || (a.time ? `${a.date}T${a.time}:00` : a.createdAt || '');
                    const bValue = b.checkinAt || (b.time ? `${b.date}T${b.time}:00` : b.createdAt || '');
                    return aValue.localeCompare(bValue);
                });
        }

        function getCheckinClockTime(checkin) {
            if (!checkin) return '';
            if (/^\d{2}:\d{2}$/.test(checkin.time || '')) return checkin.time;
            return formatStoredTime(checkin.checkinAt || checkin.createdAt || checkin.updatedAt || '').slice(0, 5);
        }

        function getHabitTargetCount(habit) {
            return Math.max(1, parseInt(habit?.timesPerDay || '1', 10) || 1);
        }

        function normalizeInlineText(text = '') {
            return String(text || '').replace(/\s+/g, ' ').trim();
        }

        function getCheckinNoteSummary(note = '', maxLength = 36) {
            const clean = normalizeInlineText(note);
            if (!clean) return '';
            return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
        }

        function getLatestHabitCheckin(habitId, date) {
            const checkins = getHabitCheckinsOnDate(habitId, date);
            return checkins[checkins.length - 1] || null;
        }

        function shouldPromptHabitNote(habit, forceNote = false) {
            if (!habit) return false;
            if (forceNote) return true;
            return habit.noteMode !== 'never';
        }

        function normalizeHabitCurrency(value) {
            return window.HabitEngine?.normalizeCurrency(value) || HABIT_DEFAULT_CURRENCY;
        }

        function normalizeHabitCurrencyList(items = [], source = data) {
            const map = new Map();
            const now = getLocalDateTimeStr();
            const add = (name, meta = {}) => {
                const currency = normalizeHabitCurrency(name);
                if (!currency) return;
                const existing = map.get(currency);
                const id = meta.id || existing?.id || (currency === HABIT_DEFAULT_CURRENCY ? 'habit-currency-default' : genId());
                const createdAt = meta.createdAt || existing?.createdAt || now;
                map.set(currency, {
                    id,
                    name: currency,
                    createdAt,
                    updatedAt: meta.updatedAt || existing?.updatedAt || meta.createdAt || createdAt
                });
            };
            add(HABIT_DEFAULT_CURRENCY, { id: 'habit-currency-default' });
            if (Array.isArray(items)) {
                items.forEach(item => add(typeof item === 'string' ? item : item?.name, item || {}));
            }
            (source?.habits || []).forEach(habit => {
                add(habit.rewardCurrency);
                add(habit.penaltyCurrency);
                add(habit.breakPenaltyCurrency);
                normalizeHabitMilestoneRewards(habit.milestoneRewards).forEach(milestone => {
                    add(milestone.currency);
                    add(milestone.penaltyCurrency);
                });
            });
            (source?.habitRewards || []).forEach(reward => add(reward.currency));
            (source?.habitPointLedger || []).forEach(entry => add(entry.currency));
            return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
        }

        function getHabitCurrencyNames() {
            return normalizeHabitCurrencyList(data.habitCurrencies).map(item => item.name);
        }

        function renderHabitCurrencyOptions() {
            const names = getHabitCurrencyNames();
            const optionHtml = names.map(name => `<option value="${escapeHtml(name)}"></option>`).join('');
            const listEl = document.getElementById('habit-currency-options');
            if (listEl) listEl.innerHTML = optionHtml;
            const container = document.getElementById('habit-currency-list');
            if (container) {
                container.innerHTML = names.map(name => `<span class="habit-currency-pill">${escapeHtml(name)}</span>`).join('');
            }
            const selectEl = document.getElementById('habit-currency-existing');
            if (selectEl) {
                selectEl.innerHTML = names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
            }
        }

        function openHabitCurrencyModal() {
            renderHabitCurrencyOptions();
            document.getElementById('habit-currency-new-name').value = '';
            document.getElementById('habit-currency-modal').classList.add('active');
            setTimeout(() => document.getElementById('habit-currency-new-name')?.focus(), 0);
        }

        function closeHabitCurrencyModal() {
            document.getElementById('habit-currency-modal').classList.remove('active');
            const input = document.getElementById('habit-currency-new-name');
            if (input) input.value = '';
        }

        function addHabitCurrencyFromModal() {
            const input = document.getElementById('habit-currency-new-name');
            const name = ensureHabitCurrency(input?.value);
            if (!name) return;
            saveData();
            dualWriteHabitAppLocalMirror('manage-currency');
            renderHabitCurrencyOptions();
            if (input) input.value = '';
        }

        function ensureHabitCurrency(value) {
            const name = normalizeHabitCurrency(value);
            const now = getLocalDateTimeStr();
            const exists = (data.habitCurrencies || []).some(item => normalizeHabitCurrency(item?.name || item) === name);
            if (!exists) {
                data.habitCurrencies = normalizeHabitCurrencyList([
                    ...(data.habitCurrencies || []),
                    { id: genId(), name, createdAt: now, updatedAt: now }
                ]);
            } else {
                data.habitCurrencies = normalizeHabitCurrencyList(data.habitCurrencies);
            }
            return name;
        }

        function formatHabitCurrencyAmount(amount, currency = HABIT_DEFAULT_CURRENCY) {
            return window.HabitEngine?.formatCurrencyAmount(amount, currency) || `${amount} ${normalizeHabitCurrency(currency)}`;
        }

        function getHabitPointBalances() {
            return window.HabitEngine?.getBalances(data.habitPointLedger) || { [HABIT_DEFAULT_CURRENCY]: 0 };
        }

        function getHabitPointBalance(currency = HABIT_DEFAULT_CURRENCY) {
            return getHabitPointBalances()[normalizeHabitCurrency(currency)] || 0;
        }

        function summarizeHabitLedgerByCurrency(filterFn, absolute = false) {
            const totals = {};
            data.habitPointLedger.filter(filterFn).forEach(entry => {
                const currency = normalizeHabitCurrency(entry.currency);
                const amount = parseInt(entry.amount || 0, 10) || 0;
                totals[currency] = (totals[currency] || 0) + (absolute ? Math.abs(amount) : amount);
            });
            return Object.entries(totals)
                .filter(([, amount]) => amount !== 0)
                .sort(([a], [b]) => a.localeCompare(b, 'zh-Hans-CN'))
                .map(([currency, amount]) => formatHabitCurrencyAmount(amount, currency))
                .join(' · ');
        }

        function getHabitMilestoneDefaults() {
            return window.HabitEngine?.getMilestoneDefaults() || [];
        }

        function normalizeHabitMilestoneRewards(milestones = []) {
            return window.HabitEngine?.normalizeMilestoneRewards(milestones) || [];
        }

        function getEnabledHabitMilestones(habit, purpose = 'reward') {
            const milestones = normalizeHabitMilestoneRewards(habit?.milestoneRewards);
            return milestones
                .filter(item => item.enabled && (purpose === 'penalty' ? item.penaltyAmount > 0 : item.rewardAmount > 0))
                .sort((a, b) => a.days - b.days);
        }

        function getHabitCycleLength(habit) {
            const milestones = normalizeHabitMilestoneRewards(habit?.milestoneRewards).filter(item => item.enabled);
            return milestones.length ? Math.max(...milestones.map(item => item.days)) : 0;
        }

        function getCompletedHabitDateSet(habit, upToDate = '') {
            const dateSet = new Set();
            if (!habit) return dateSet;
            const byDate = {};
            data.checkins.forEach(checkin => {
                if (checkin.habitId !== habit.id) return;
                if (upToDate && checkin.date > upToDate) return;
                byDate[checkin.date] = (byDate[checkin.date] || 0) + 1;
            });
            const targetCount = getHabitTargetCount(habit);
            Object.entries(byDate).forEach(([date, count]) => {
                if (count >= targetCount) dateSet.add(date);
            });
            return dateSet;
        }

        function getHabitStreakEndingOn(habit, date) {
            const dateSet = getCompletedHabitDateSet(habit, date);
            let streak = 0;
            let cursor = date;
            while (dateSet.has(cursor)) {
                streak++;
                cursor = addDays(cursor, -1);
            }
            return streak;
        }

        function getHabitStreakBeforeDate(habit, date) {
            return getHabitStreakEndingOn(habit, addDays(date, -1));
        }

        function getMilestoneCyclePosition(habit, streak) {
            const cycleLength = getHabitCycleLength(habit);
            if (!cycleLength || streak <= 0) return null;
            return window.HabitEngine?.getCyclePosition(streak, cycleLength) || null;
        }

        function getNextHabitMilestoneForPenalty(habit, previousStreak) {
            const milestones = getEnabledHabitMilestones(habit, 'penalty');
            const cycleLength = getHabitCycleLength(habit);
            if (!milestones.length || !cycleLength || previousStreak <= 0) return null;
            const dayInCycle = ((previousStreak - 1) % cycleLength) + 1;
            return milestones.find(item => item.days > dayInCycle) || milestones[0];
        }

        function getHabitRewardValue(habit) {
            if (!habit) return 0;
            if (habit.randomReward) {
                const min = Math.max(0, parseInt(habit.rewardMin ?? habit.rewardPoints ?? 0, 10) || 0);
                const max = Math.max(min, parseInt(habit.rewardMax ?? habit.rewardPoints ?? min, 10) || min);
                return Math.floor(Math.random() * (max - min + 1)) + min;
            }
            return Math.max(0, parseInt(habit.rewardPoints ?? 0, 10) || 0);
        }

        function addHabitPointEntry({ amount, type, habitId = '', rewardId = '', sourceId = '', date = getTodayStr(), note = '', currency = HABIT_DEFAULT_CURRENCY }) {
            const value = parseInt(amount || 0, 10) || 0;
            if (value === 0) return null;
            const now = getLocalDateTimeStr();
            const entry = {
                id: genId(),
                amount: value,
                currency: normalizeHabitCurrency(currency),
                type,
                habitId,
                rewardId,
                sourceId,
                date,
                note,
                createdAt: now,
                updatedAt: now
            };
            data.habitPointLedger.push(entry);
            return entry;
        }

        function addHabitCheckinReward(habit, checkin) {
            if (!habit || !checkin) return null;
            if (data.habitPointLedger.some(entry => entry.type === 'checkin' && entry.sourceId === checkin.id)) return null;
            const amount = getHabitRewardValue(habit);
            return addHabitPointEntry({
                amount,
                type: 'checkin',
                habitId: habit.id,
                sourceId: checkin.id,
                date: checkin.date,
                note: `完成「${habit.name}」`,
                currency: habit.rewardCurrency
            });
        }

        function addHabitMilestoneRewards(habit, checkin) {
            if (!habit || !checkin) return [];
            if (getCheckinCount(habit.id, checkin.date) < getHabitTargetCount(habit)) return [];
            const position = getMilestoneCyclePosition(habit, getHabitStreakEndingOn(habit, checkin.date));
            if (!position) return [];
            const rewards = [];
            getEnabledHabitMilestones(habit, 'reward').forEach(milestone => {
                if (milestone.days !== position.dayInCycle) return;
                const sourceId = `${checkin.id}:milestone:${position.cycleLength}:${position.cycleIndex}:${milestone.days}`;
                if (data.habitPointLedger.some(entry => entry.type === 'milestone' && entry.sourceId === sourceId)) return;
                const entry = addHabitPointEntry({
                    amount: milestone.rewardAmount,
                    currency: milestone.currency,
                    type: 'milestone',
                    habitId: habit.id,
                    sourceId,
                    date: checkin.date,
                    note: `连续${HABIT_MILESTONE_LABELS[milestone.days] || `${milestone.days}天`}奖励「${habit.name}」`
                });
                if (entry) rewards.push(entry);
            });
            return rewards;
        }

        function reverseHabitCheckinReward(habit, checkin, reason = '撤销打卡') {
            if (!habit || !checkin) return null;
            if (data.habitPointLedger.some(entry => entry.type === 'reverse' && entry.sourceId === checkin.id)) return null;
            const related = data.habitPointLedger.filter(entry =>
                (entry.type === 'checkin' && entry.sourceId === checkin.id) ||
                (entry.type === 'milestone' && String(entry.sourceId || '').startsWith(`${checkin.id}:milestone:`))
            );
            const totalsByCurrency = {};
            related.forEach(entry => {
                const currency = normalizeHabitCurrency(entry.currency);
                totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + (parseInt(entry.amount || 0, 10) || 0);
            });
            const reversals = [];
            Object.entries(totalsByCurrency).forEach(([currency, total]) => {
                if (total === 0) return;
                const entry = addHabitPointEntry({
                    amount: -total,
                    currency,
                    type: 'reverse',
                    habitId: habit.id,
                    sourceId: checkin.id,
                    date: checkin.date,
                    note: `${reason}「${habit.name}」`
                });
                if (entry) reversals.push(entry);
            });
            return reversals[0] || null;
        }

        function reverseHabitPenaltiesForDate(habit, date, reason = '补卡冲销扣分') {
            if (!habit || !date) return [];
            const sourceId = `${habit.id}:${date}:penalty-reversal`;
            const penaltyEntries = data.habitPointLedger.filter(entry =>
                entry.habitId === habit.id &&
                entry.date === date &&
                ['miss', 'break'].includes(entry.type) &&
                (parseInt(entry.amount || 0, 10) || 0) < 0
            );
            if (!penaltyEntries.length) return [];
            const existingReversals = data.habitPointLedger.filter(entry =>
                entry.type === 'reverse-penalty' &&
                String(entry.sourceId || '').startsWith(`${sourceId}:`)
            );
            const alreadyReversedByCurrency = {};
            existingReversals.forEach(entry => {
                const currency = normalizeHabitCurrency(entry.currency);
                alreadyReversedByCurrency[currency] = (alreadyReversedByCurrency[currency] || 0) + (parseInt(entry.amount || 0, 10) || 0);
            });

            const penaltyTotalsByCurrency = {};
            penaltyEntries.forEach(entry => {
                const currency = normalizeHabitCurrency(entry.currency);
                penaltyTotalsByCurrency[currency] = (penaltyTotalsByCurrency[currency] || 0) + Math.abs(parseInt(entry.amount || 0, 10) || 0);
            });

            const reversals = [];
            Object.entries(penaltyTotalsByCurrency).forEach(([currency, total]) => {
                const remaining = total - (alreadyReversedByCurrency[currency] || 0);
                if (remaining <= 0) return;
                const entry = addHabitPointEntry({
                    amount: remaining,
                    currency,
                    type: 'reverse-penalty',
                    habitId: habit.id,
                    sourceId: `${sourceId}:${currency}`,
                    date,
                    note: `${reason}「${habit.name}」`
                });
                if (entry) reversals.push(entry);
            });
            return reversals;
        }

        function applyHabitMissPenalty(habit, date) {
            const penalty = Math.max(0, parseInt(habit?.penaltyPoints || 0, 10) || 0);
            if (!habit || penalty <= 0) return null;
            const sourceId = `${habit.id}:${date}:miss`;
            if (data.habitPointLedger.some(entry => entry.sourceId === sourceId)) return null;
            if (!isHabitDueOnDate(habit, date)) return null;
            if (getCheckinCount(habit.id, date) >= getHabitTargetCount(habit)) return null;
            return addHabitPointEntry({
                amount: -penalty,
                type: 'miss',
                habitId: habit.id,
                sourceId,
                date,
                note: `未完成「${habit.name}」`,
                currency: habit.penaltyCurrency
            });
        }

        function applyHabitBreakPenalty(habit, date) {
            if (!habit || !isHabitDueOnDate(habit, date)) return null;
            if (getCheckinCount(habit.id, date) >= getHabitTargetCount(habit)) return null;
            const previousStreak = getHabitStreakBeforeDate(habit, date);
            if (previousStreak <= 0) return null;

            if (habit.breakPenaltyMode === 'fixed') {
                const penalty = Math.max(0, parseInt(habit.breakPenaltyPoints || 0, 10) || 0);
                if (penalty <= 0) return null;
                const sourceId = `${habit.id}:${date}:break:fixed`;
                if (data.habitPointLedger.some(entry => entry.sourceId === sourceId)) return null;
                return addHabitPointEntry({
                    amount: -penalty,
                    currency: habit.breakPenaltyCurrency,
                    type: 'break',
                    habitId: habit.id,
                    sourceId,
                    date,
                    note: `断签「${habit.name}」`
                });
            }

            if (habit.breakPenaltyMode === 'stage') {
                const milestone = getNextHabitMilestoneForPenalty(habit, previousStreak);
                if (!milestone) return null;
                const sourceId = `${habit.id}:${date}:break:stage:${milestone.days}`;
                if (data.habitPointLedger.some(entry => entry.sourceId === sourceId)) return null;
                return addHabitPointEntry({
                    amount: -milestone.penaltyAmount,
                    currency: milestone.penaltyCurrency,
                    type: 'break',
                    habitId: habit.id,
                    sourceId,
                    date,
                    note: `未达${HABIT_MILESTONE_LABELS[milestone.days] || `${milestone.days}天`}断签「${habit.name}」`
                });
            }

            return null;
        }

        function settleHabitPenaltiesThroughYesterday() {
            const yesterday = addDays(getTodayStr(), -1);
            let changed = false;
            data.habits.forEach(habit => {
                const start = habit.startDate || yesterday;
                if (start > yesterday) return;
                for (let date = start; date <= yesterday; date = addDays(date, 1)) {
                    if (applyHabitMissPenalty(habit, date)) changed = true;
                    if (applyHabitBreakPenalty(habit, date)) changed = true;
                }
            });
            if (changed) {
                saveData();
                dualWriteHabitAppLocalMirror('settle-penalties');
                renderHabitRewards();
                renderTodayHabits();
            }
        }

        function settleYesterdayHabitPenalties() {
            settleHabitPenaltiesThroughYesterday();
        }

        function appendHabitCheckin(habit, date, note = '') {
            if (!habit) return false;
            if (date > getTodayStr()) {
                alert('不能补未来日期的习惯打卡');
                return false;
            }
            if (habit.timesPerDay === '1' && getCheckinCount(habit.id, date) > 0) return false;
            const now = new Date();
            const checkin = createHabitCheckin(habit.id, date, now, note);
            data.checkins.push(checkin);
            addHabitCheckinReward(habit, checkin);
            addHabitMilestoneRewards(habit, checkin);
            reverseHabitPenaltiesForDate(habit, date);
            touchHabit(habit, now);
            saveData();
            dualWriteHabitAppLocalMirror('append-checkin');
            return true;
        }

        function refreshHabitCheckinViews() {
            renderDashboard();
            renderAllRecords();
            renderHabitMatrix();
            renderHabitRewards();
            if (currentHabitId) renderHeatmap();
            renderHabitCurrentView();
        }

        function openHabitNoteModal({ habitId, date = getTodayStr(), mode = 'create', checkinId = '' } = {}) {
            const habit = data.habits.find(h => h.id === habitId);
            if (!habit) return;
            const latestCheckin = checkinId ? data.checkins.find(c => c.id === checkinId) : getLatestHabitCheckin(habitId, date);
            pendingHabitNoteContext = { habitId, date, mode, checkinId: latestCheckin?.id || checkinId || '' };

            document.getElementById('habit-note-modal-title').textContent = `备注 · ${habit.name}`;
            document.getElementById('habit-note-input').value = mode === 'edit' ? (latestCheckin?.note || '') : '';
            document.getElementById('habit-note-disable').checked = false;
            document.getElementById('habit-note-skip-btn').style.display = mode === 'edit' ? 'none' : 'inline-flex';
            document.getElementById('habit-note-save-btn').textContent = mode === 'edit' ? '保存' : '保存';
            document.getElementById('habit-note-modal').classList.add('active');
            document.getElementById('habit-note-input').focus();
        }

        function closeHabitNoteModal() {
            document.getElementById('habit-note-modal').classList.remove('active');
            pendingHabitNoteContext = null;
            document.getElementById('habit-note-input').value = '';
            document.getElementById('habit-note-disable').checked = false;
        }

        function submitHabitNoteModal(saveNote = true) {
            const context = pendingHabitNoteContext;
            if (!context) return;
            const habit = data.habits.find(h => h.id === context.habitId);
            if (!habit) {
                closeHabitNoteModal();
                return;
            }

            const noteValue = document.getElementById('habit-note-input').value.trim();
            const disableFuturePrompt = document.getElementById('habit-note-disable').checked;
            const now = new Date();

            if (context.mode === 'edit') {
                const checkin = data.checkins.find(c => c.id === context.checkinId) || getLatestHabitCheckin(context.habitId, context.date);
                if (!checkin) {
                    closeHabitNoteModal();
                    return;
                }
                checkin.note = saveNote ? noteValue : checkin.note || '';
                checkin.updatedAt = getLocalDateTimeStr(now);
            } else {
                const created = appendHabitCheckin(habit, context.date, saveNote ? noteValue : '');
                if (!created) {
                    closeHabitNoteModal();
                    refreshHabitCheckinViews();
                    return;
                }
            }

            if (disableFuturePrompt) {
                habit.noteMode = 'never';
            }
            touchHabit(habit, now);
            saveData();
            dualWriteHabitAppLocalMirror(context.mode === 'edit' ? 'edit-checkin-note' : 'append-checkin');
            closeHabitNoteModal();
            refreshHabitCheckinViews();
        }

        function createHabitCheckin(habitId, date, now = new Date(), note = '') {
            const timestamp = composeDateTimeWithClock(date, now);
            return {
                id: genId(),
                habitId,
                date,
                time: formatClockTime(now),
                checkinAt: timestamp,
                createdAt: timestamp,
                updatedAt: getLocalDateTimeStr(now),
                note: String(note || '').trim()
            };
        }

        function touchHabit(habit, now = new Date()) {
            if (habit) habit.updatedAt = getLocalDateTimeStr(now);
        }

        // 打卡/取消打卡（带确认 + 同步时间轴）
        function toggleCheckin(habitId, date, skipConfirm = false) {
            const habit = data.habits.find(h => h.id === habitId);
            if (!habit) return;
            if (date > getTodayStr()) {
                alert('不能补未来日期的习惯打卡');
                return;
            }

            const count = getCheckinCount(habitId, date);
            const isChecked = count > 0;
            const action = isChecked ? '取消打卡' : '补卡';

            if (!skipConfirm && !confirm(`确认要对【${habit.name}】${action} ${date} 吗？`)) return;

            const now = new Date();
            if (habit.timesPerDay === '1') {
                // 每天1次：切换有无
                if (isChecked) {
                    getHabitCheckinsOnDate(habitId, date).forEach(checkin => reverseHabitCheckinReward(habit, checkin));
                    data.checkins = data.checkins.filter(c => !(c.habitId === habitId && c.date === date));
                } else {
                    const checkin = createHabitCheckin(habitId, date, now);
                    data.checkins.push(checkin);
                    addHabitCheckinReward(habit, checkin);
                    addHabitMilestoneRewards(habit, checkin);
                    reverseHabitPenaltiesForDate(habit, date);
                }
            } else {
                // 每天多次：左键+1
                const checkin = createHabitCheckin(habitId, date, now);
                data.checkins.push(checkin);
                addHabitCheckinReward(habit, checkin);
                addHabitMilestoneRewards(habit, checkin);
                reverseHabitPenaltiesForDate(habit, date);
            }

            touchHabit(habit, now);
            saveData();
            dualWriteHabitAppLocalMirror('toggle-checkin');
            renderHabitRewards();
            if (currentHabitView === 'analysis') renderHabitMatrix();
            renderAllRecords();
        }

        // 右键减次数
        function decreaseCheckin(habitId, date) {
            if (date > getTodayStr()) return;
            const existing = getHabitCheckinsOnDate(habitId, date).pop();
            if (!existing) return;
            
            if (!confirm(`确认要减少【${data.habits.find(h=>h.id===habitId).name}】${date} 的打卡次数吗？`)) return;

            const habit = data.habits.find(h => h.id === habitId);
            reverseHabitCheckinReward(habit, existing);
            data.checkins = data.checkins.filter(c => c.id !== existing.id);
            touchHabit(habit);
            
            saveData();
            dualWriteHabitAppLocalMirror('decrease-checkin');
            renderHabitRewards();
            if (currentHabitView === 'analysis') renderHabitMatrix();
            renderAllRecords();
        }

        function quickHabitCheckin(habitId) {
            const habit = data.habits.find(h => h.id === habitId);
            if (!habit) return;
            const today = getTodayStr();
            if (getHabitTargetCount(habit) === 1 && getCheckinCount(habitId, today) > 0) {
                editLatestHabitNote(habitId);
                return;
            }
            if (shouldPromptHabitNote(habit)) {
                openHabitNoteModal({ habitId, date: today, mode: 'create' });
                return;
            }
            if (appendHabitCheckin(habit, today)) refreshHabitCheckinViews();
        }

        function quickHabitCheckinWithNote(habitId) {
            const habit = data.habits.find(h => h.id === habitId);
            if (!habit) return;
            const today = getTodayStr();
            const existingCount = getCheckinCount(habitId, today);
            if (getHabitTargetCount(habit) === 1 && existingCount > 0) {
                editLatestHabitNote(habitId);
                return;
            }
            openHabitNoteModal({ habitId, date: today, mode: 'create' });
        }

        function editLatestHabitNote(habitId, date = getTodayStr()) {
            const habit = data.habits.find(h => h.id === habitId);
            if (!habit) return;
            const latestCheckin = getLatestHabitCheckin(habitId, date);
            if (!latestCheckin) {
                alert('今天还没有这条习惯的打卡记录，先打卡再写备注会更稳妥。');
                return;
            }
            openHabitNoteModal({ habitId, date, mode: 'edit', checkinId: latestCheckin.id });
        }

        function quickUndoHabitCheckin(habitId) {
            toggleCheckin(habitId, getTodayStr());
            refreshHabitCheckinViews();
        }

        function quickDecreaseHabitCheckin(habitId) {
            decreaseCheckin(habitId, getTodayStr());
            refreshHabitCheckinViews();
        }

        // 新增：习惯打卡写入时间轴
        function addHabitToTimeline(habit, dateStr) {
            const recordType = `习惯打卡-${habit.tag}`;
            const timeStr = new Date().toTimeString().slice(0, 5);
            // 避免重复生成
            const exists = data.records.some(r => 
                r.type === recordType && 
                r.startDate === dateStr && 
                r.habitId === habit.id
            );
            if (exists) return;

            data.records.push({
                id: genId(),
                type: recordType,
                title: habit.name,
                startDate: dateStr,
                endDate: dateStr,
                content: `完成【${habit.name}】打卡，标签：${habit.tag}`,
                habitId: habit.id,
                isHabitRecord: true,
                recordTime: timeStr,
                createdAt: getLocalDateTimeStr(),
                updatedAt: getLocalDateTimeStr(),
                todoIds: []
            });
        }

        // 新增：取消打卡时移除时间轴记录
        function removeHabitFromTimeline(habitId, dateStr) {
            data.records = data.records.filter(r => 
                !(r.isHabitRecord && r.habitId === habitId && r.startDate === dateStr)
            );
        }

        // 获取习惯规则文本
        function getHabitRuleText(habit) {
            const ruleMap = {
                'daily': '每天',
                'weekly-fixed': '固定周几',
                'weekly-count': `每周${habit.count}次`,
                'monthly-count': `每月${habit.count}次`,
                'interval': `每${habit.count}天`
            };
            return ruleMap[habit.rule] || '自定义';
        }

        function renderHeatmap() {
            if (!currentHabitId) return;
            
            const habit = data.habits.find(h => h.id === currentHabitId);
            if (!habit) return;

            document.getElementById('current-habit-name').textContent = habit.name;

            const year = parseInt(document.getElementById('year-select').value);
            const container = document.getElementById('heatmap');
            const monthsLabel = document.getElementById('heatmap-months');
            
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31);
            
            // 对齐到周一
            const startDay = startDate.getDay() || 7;
            const firstMonday = new Date(startDate);
            firstMonday.setDate(startDate.getDate() - startDay + 1);

            const cells = [];
            const months = [];
            let currentMonth = -1;

            let d = new Date(firstMonday);
            while (d <= endDate || d.getDay() !== 1) {
                const dateStr = formatLocalDateKey(d);
                const checkinsOnDate = getHabitCheckinsOnDate(currentHabitId, dateStr);
                const count = checkinsOnDate.length;
                const notedCheckin = [...checkinsOnDate].reverse().find(checkin => normalizeInlineText(checkin.note));
                const noteSummary = notedCheckin ? getCheckinNoteSummary(notedCheckin.note, 24) : '';
                
                let level = 0;
                if (count >= 1) level = 1;
                if (count >= 2) level = 2;
                if (count >= 4) level = 3;
                if (count >= 7) level = 4;

                const isCurrentYear = d.getFullYear() === year;
                const isFuture = dateStr > getTodayStr();
                cells.push(`
                    <div class="heatmap-cell ${isCurrentYear ? 'level-' + level : ''} ${isFuture ? 'future' : ''} ${noteSummary ? 'has-note' : ''}" 
                        data-date="${dateStr}"
                        data-count="${count}"
                        data-note="${noteSummary ? ` · 备注 ${escapeHtml(noteSummary)}` : ''}"
                        ${isFuture ? '' : `onclick="toggleCheckin(${escapeJsArg(currentHabitId)}, ${escapeJsArg(dateStr)}); renderHeatmap(); renderTimeline(); renderHabitMatrix();"`}
                        ${isFuture ? '' : `oncontextmenu="event.preventDefault(); decreaseCheckin(${escapeJsArg(currentHabitId)}, ${escapeJsArg(dateStr)}); renderHeatmap(); renderTimeline(); renderHabitMatrix();"`}>
                    </div>
                `);

                // 月份标签
                if (d.getDate() <= 7 && d.getMonth() !== currentMonth) {
                    currentMonth = d.getMonth();
                    months.push(['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'][currentMonth]);
                }

                d.setDate(d.getDate() + 1);
            }

            container.innerHTML = cells.join('');
            monthsLabel.innerHTML = months.map(m => `<span>${m}</span>`).join('');

            renderHabitStats(habit, year);
            renderHabitCheckinHistory(habit);
        }

        function renderHabitCheckinHistory(habit) {
            const container = document.getElementById('habit-checkin-history');
            if (!container) return;
            if (!habit) {
                container.innerHTML = '';
                return;
            }

            const checkins = data.checkins
                .filter(checkin => checkin.habitId === habit.id)
                .sort((a, b) => {
                    const aValue = a.checkinAt || (a.time ? `${a.date}T${a.time}:00` : a.createdAt || a.updatedAt || '');
                    const bValue = b.checkinAt || (b.time ? `${b.date}T${b.time}:00` : b.createdAt || b.updatedAt || '');
                    return bValue.localeCompare(aValue);
                });
            const noteCount = checkins.filter(checkin => normalizeInlineText(checkin.note)).length;
            const recentCheckins = checkins.slice(0, 30);

            if (checkins.length === 0) {
                container.innerHTML = `
                    <div class="habit-history-head">
                        <div>
                            <div class="habit-history-title">最近打卡备注</div>
                            <div class="habit-history-meta">${escapeHtml(habit.name)}</div>
                        </div>
                    </div>
                    <div class="habit-history-empty">这条习惯还没有打卡记录</div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="habit-history-head">
                    <div>
                        <div class="habit-history-title">最近打卡备注</div>
                        <div class="habit-history-meta">${escapeHtml(habit.name)} · ${checkins.length} 次打卡 · ${noteCount} 条备注</div>
                    </div>
                </div>
                <div class="habit-history-list">
                    ${recentCheckins.map(checkin => {
                        const noteText = normalizeInlineText(checkin.note);
                        const notePreview = getCheckinNoteSummary(noteText, 72);
                        const clockTime = getCheckinClockTime(checkin);
                        return `
                            <div class="habit-history-item ${noteText ? 'has-note' : ''}">
                                <div class="habit-history-main">
                                    <div class="habit-history-date">${formatDate(checkin.date)}${clockTime ? ` ${escapeHtml(clockTime)}` : ''}</div>
                                    <div class="habit-history-note">${notePreview ? escapeHtml(notePreview) : '暂无备注'}</div>
                                </div>
                                <button class="btn btn-secondary todo-mini-btn" onclick="openHabitCheckinNote(${escapeJsArg(checkin.id)})">${noteText ? '编辑' : '补备注'}</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        function openHabitCheckinNote(checkinId) {
            const checkin = data.checkins.find(item => item.id === checkinId);
            if (!checkin) return;
            openHabitNoteModal({
                habitId: checkin.habitId,
                date: checkin.date,
                mode: 'edit',
                checkinId: checkin.id
            });
        }

        function renderHabitStats(habit, year) {
            const allCheckins = data.checkins.filter(c => c.habitId === habit.id);
            const totalDays = new Set(allCheckins.map(c => c.date)).size;
            const lastOperation = habit.updatedAt || allCheckins
                .map(c => c.updatedAt || c.createdAt || c.checkinAt || '')
                .filter(Boolean)
                .sort()
                .pop() || '';
            
            // 连续打卡计算
            const dateSet = new Set(allCheckins.map(c => c.date));
            let currentStreak = 0;
            let maxStreak = 0;
            let tempStreak = 0;
            
            const sortedDates = Array.from(dateSet).sort();
            for (let i = 0; i < sortedDates.length; i++) {
                if (i === 0) {
                    tempStreak = 1;
                } else {
                    const prev = parseLocalDate(sortedDates[i-1]);
                    const curr = parseLocalDate(sortedDates[i]);
                    const diff = (curr - prev) / (1000*60*60*24);
                    if (diff === 1) {
                        tempStreak++;
                    } else {
                        maxStreak = Math.max(maxStreak, tempStreak);
                        tempStreak = 1;
                    }
                }
            }
            maxStreak = Math.max(maxStreak, tempStreak);

            // 当前连续
            const today = getTodayStr();
            let d = parseLocalDate(today);
            while (dateSet.has(formatLocalDateKey(d))) {
                currentStreak++;
                d.setDate(d.getDate() - 1);
            }

            // 本月完成率
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const monthDays = Math.ceil((monthEnd - monthStart) / (1000*60*60*24));
            const monthCheckins = allCheckins.filter(c => {
                const cd = parseLocalDate(c.date);
                return cd >= monthStart && cd <= monthEnd;
            }).length;
            const monthRate = monthDays > 0 ? Math.round(monthCheckins / monthDays * 100) : 0;

            // 本年完成率
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31);
            const yearDays = Math.ceil((yearEnd - yearStart) / (1000*60*60*24)) + 1;
            const yearCheckins = new Set(allCheckins.filter(c => {
                const cd = parseLocalDate(c.date);
                return cd >= yearStart && cd <= yearEnd;
            }).map(c => c.date)).size;
            const yearRate = Math.round(yearCheckins / yearDays * 100);

            document.getElementById('habit-stats').innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${totalDays}</div>
                    <div class="stat-label">累计打卡天数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${currentStreak}</div>
                    <div class="stat-label">当前连续天数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${maxStreak}</div>
                    <div class="stat-label">最长连续天数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${monthRate}%</div>
                    <div class="stat-label">本月完成率</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${yearRate}%</div>
                    <div class="stat-label">本年完成率</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="font-size:14px; line-height:1.45;">${lastOperation ? formatStoredDateTime(lastOperation) : '暂无'}</div>
                    <div class="stat-label">最后操作时间</div>
                </div>
            `;
        }

        function openHabitModal() {
            editingHabitId = null;
            document.getElementById('habit-modal-title').textContent = '新建习惯';
            document.getElementById('habit-name').value = '';
            document.getElementById('habit-rule').value = 'daily';
            document.getElementById('habit-times').value = '1';
            document.getElementById('habit-tag').value = '全天';
            document.getElementById('habit-goal').value = '0';
            document.getElementById('habit-count').value = '3';
            document.getElementById('habit-note-mode').value = 'ask';
            document.getElementById('habit-reward-points').value = '0';
            document.getElementById('habit-reward-currency').value = HABIT_DEFAULT_CURRENCY;
            document.getElementById('habit-penalty-points').value = '0';
            document.getElementById('habit-penalty-currency').value = HABIT_DEFAULT_CURRENCY;
            document.getElementById('habit-random-reward').checked = false;
            document.getElementById('habit-reward-min').value = '0';
            document.getElementById('habit-reward-max').value = '0';
            document.getElementById('habit-break-penalty-mode').value = 'none';
            document.getElementById('habit-break-penalty-points').value = '0';
            document.getElementById('habit-break-penalty-currency').value = HABIT_DEFAULT_CURRENCY;
            HabitUi.resetMilestoneFields();
            document.getElementById('habit-points-panel').open = false;
            toggleHabitRewardRange();
            toggleHabitBreakPenaltyMode();
            
            document.querySelectorAll('#rule-weekdays input').forEach(i => i.checked = false);
            toggleHabitRule();
            
            document.getElementById('habit-modal').classList.add('active');
        }

        function editCurrentHabit() {
            if (!currentHabitId) return;
            const habit = data.habits.find(h => h.id === currentHabitId);
            if (!habit) return;

            editingHabitId = currentHabitId;
            document.getElementById('habit-modal-title').textContent = '编辑习惯';
            document.getElementById('habit-name').value = habit.name;
            document.getElementById('habit-rule').value = habit.rule;
            document.getElementById('habit-times').value = habit.timesPerDay;
            document.getElementById('habit-tag').value = habit.tag;
            document.getElementById('habit-goal').value = habit.goalCount || 0;
            document.getElementById('habit-count').value = habit.count || 3;
            document.getElementById('habit-note-mode').value = habit.noteMode || 'ask';
            document.getElementById('habit-reward-points').value = habit.rewardPoints ?? 0;
            document.getElementById('habit-reward-currency').value = normalizeHabitCurrency(habit.rewardCurrency);
            document.getElementById('habit-penalty-points').value = habit.penaltyPoints ?? 0;
            document.getElementById('habit-penalty-currency').value = normalizeHabitCurrency(habit.penaltyCurrency);
            document.getElementById('habit-random-reward').checked = !!habit.randomReward;
            document.getElementById('habit-reward-min').value = habit.rewardMin ?? habit.rewardPoints ?? 0;
            document.getElementById('habit-reward-max').value = habit.rewardMax ?? habit.rewardPoints ?? 0;
            document.getElementById('habit-break-penalty-mode').value = habit.breakPenaltyMode || 'none';
            document.getElementById('habit-break-penalty-points').value = habit.breakPenaltyPoints ?? 0;
            document.getElementById('habit-break-penalty-currency').value = normalizeHabitCurrency(habit.breakPenaltyCurrency);
            HabitUi.loadMilestoneFields(habit.milestoneRewards);
            document.getElementById('habit-points-panel').open = !!(
                habit.penaltyPoints ||
                habit.randomReward ||
                habit.breakPenaltyMode !== 'none' ||
                (habit.rewardPoints ?? 0) > 0 ||
                normalizeHabitMilestoneRewards(habit.milestoneRewards).some(item => item.enabled)
            );

            if (habit.weekdays) {
                document.querySelectorAll('#rule-weekdays input').forEach(i => {
                    i.checked = habit.weekdays.includes(i.value);
                });
            }

            toggleHabitRule();
            toggleHabitRewardRange();
            toggleHabitBreakPenaltyMode();
            document.getElementById('habit-modal').classList.add('active');
        }

        function closeHabitModal() {
            document.getElementById('habit-modal').classList.remove('active');
            editingHabitId = null;
            // Clear abandoned draft values so reopening "新建习惯" never shows stale fields.
            const nameEl = document.getElementById('habit-name');
            const tagEl = document.getElementById('habit-tag');
            const noteEl = document.getElementById('habit-note');
            if (nameEl) nameEl.value = '';
            if (tagEl) tagEl.value = '';
            if (noteEl) noteEl.value = '';
        }

        function toggleHabitRule() {
            const rule = document.getElementById('habit-rule').value;
            document.getElementById('rule-weekdays').style.display = rule === 'weekly-fixed' ? 'block' : 'none';
            document.getElementById('rule-count').style.display = ['weekly-count','monthly-count','interval'].includes(rule) ? 'block' : 'none';
        }

        function toggleHabitRewardRange() {
            const enabled = document.getElementById('habit-random-reward')?.checked;
            const rangeEl = document.getElementById('habit-reward-range');
            if (rangeEl) rangeEl.style.display = enabled ? 'grid' : 'none';
        }

        function toggleHabitBreakPenaltyMode() {
            const mode = document.getElementById('habit-break-penalty-mode')?.value || 'none';
            const fixedEl = document.getElementById('habit-break-fixed-fields');
            if (fixedEl) fixedEl.style.display = mode === 'fixed' ? 'block' : 'none';
        }

        function saveHabit() {
            const name = document.getElementById('habit-name').value.trim();
            if (!name) {
                alert('请输入习惯名称');
                return;
            }

            const rule = document.getElementById('habit-rule').value;
            let weekdays = [];
            if (rule === 'weekly-fixed') {
                weekdays = Array.from(document.querySelectorAll('#rule-weekdays input:checked')).map(i => i.value);
                if (weekdays.length === 0) {
                    alert('请至少选择一天');
                    return;
                }
            }

            const count = parseInt(document.getElementById('habit-count').value) || 3;
            const randomReward = !!document.getElementById('habit-random-reward').checked;
            const rewardPoints = Math.max(0, parseInt(document.getElementById('habit-reward-points').value || '0', 10) || 0);
            const rewardMin = Math.max(0, parseInt(document.getElementById('habit-reward-min').value || rewardPoints, 10) || 0);
            const rewardMax = Math.max(rewardMin, parseInt(document.getElementById('habit-reward-max').value || rewardMin, 10) || rewardMin);
            const breakPenaltyMode = document.getElementById('habit-break-penalty-mode').value || 'none';
            const milestoneRewards = HabitUi.collectMilestoneFields().map(item => ({
                ...item,
                currency: ensureHabitCurrency(item.currency),
                penaltyCurrency: ensureHabitCurrency(item.penaltyCurrency)
            }));

            const habitData = {
                name: name,
                rule: rule,
                weekdays: weekdays,
                count: count,
                timesPerDay: document.getElementById('habit-times').value,
                tag: document.getElementById('habit-tag').value,
                goalCount: parseInt(document.getElementById('habit-goal').value) || 0,
                noteMode: document.getElementById('habit-note-mode').value || 'ask',
                rewardPoints,
                rewardCurrency: ensureHabitCurrency(document.getElementById('habit-reward-currency').value),
                penaltyPoints: Math.max(0, parseInt(document.getElementById('habit-penalty-points').value || '0', 10) || 0),
                penaltyCurrency: ensureHabitCurrency(document.getElementById('habit-penalty-currency').value),
                randomReward,
                rewardMin,
                rewardMax,
                breakPenaltyMode,
                breakPenaltyPoints: Math.max(0, parseInt(document.getElementById('habit-break-penalty-points').value || '0', 10) || 0),
                breakPenaltyCurrency: ensureHabitCurrency(document.getElementById('habit-break-penalty-currency').value),
                milestoneRewards
            };

            const habitComparable = habit => JSON.stringify({
                name: habit.name || '',
                rule: habit.rule || '',
                weekdays: habit.weekdays || [],
                count: habit.count || 0,
                timesPerDay: habit.timesPerDay || '1',
                tag: habit.tag || '',
                goalCount: habit.goalCount || 0,
                noteMode: habit.noteMode || 'ask',
                rewardPoints: habit.rewardPoints ?? 0,
                rewardCurrency: normalizeHabitCurrency(habit.rewardCurrency),
                penaltyPoints: habit.penaltyPoints || 0,
                penaltyCurrency: normalizeHabitCurrency(habit.penaltyCurrency),
                randomReward: !!habit.randomReward,
                rewardMin: habit.rewardMin ?? habit.rewardPoints ?? 0,
                rewardMax: habit.rewardMax ?? habit.rewardPoints ?? 0,
                breakPenaltyMode: habit.breakPenaltyMode || 'none',
                breakPenaltyPoints: habit.breakPenaltyPoints || 0,
                breakPenaltyCurrency: normalizeHabitCurrency(habit.breakPenaltyCurrency),
                milestoneRewards: normalizeHabitMilestoneRewards(habit.milestoneRewards)
            });

            if (editingHabitId) {
                const habit = data.habits.find(h => h.id === editingHabitId);
                if (habit) {
                    const before = habitComparable(habit);
                    const after = habitComparable(habitData);
                    if (before === after) {
                        closeHabitModal();
                        return;
                    }
                    // 标签变了就同步更新时间轴里的类型
                    if (habit.tag !== habitData.tag) {
                        data.records.forEach(r => {
                            if (r.isHabitRecord && r.habitId === editingHabitId) {
                                r.type = `习惯打卡-${habitData.tag}`;
                                r.updatedAt = getLocalDateTimeStr();
                            }
                        });
                    }
                    habitData.startDate = habit.startDate || getTodayStr();
                    habitData.createdAt = habit.createdAt || getLocalDateTimeStr();
                    habitData.updatedAt = getLocalDateTimeStr();
                    Object.assign(habit, habitData);
                }
            } else {
                habitData.id = genId();
                habitData.startDate = getTodayStr();
                habitData.createdAt = getLocalDateTimeStr();
                habitData.updatedAt = habitData.createdAt;
                data.habits.push(habitData);
                currentHabitId = habitData.id;
            }

            saveData();
            dualWriteHabitAppLocalMirror('save-habit');
            closeHabitModal();
            renderHabitCurrencyOptions();
            renderHabitTabs();
            renderHabitRewards();
            renderHeatmap();
            renderHabitMatrix();
            renderDashboard();
            renderTimeline();
            renderAllRecords();
        }

        function deleteCurrentHabit() {
            if (!currentHabitId) return;
            if (!confirm('确定删除这个习惯吗？所有历史打卡记录和时间轴条目都会一起删除')) return;
            const deletedHabit = data.habits.find(h => h.id === currentHabitId);
            markDeletedItem('habits', currentHabitId, { reason: 'manual-delete', name: deletedHabit?.name || '' });
            data.checkins
                .filter(c => c.habitId === currentHabitId)
                .forEach(c => markDeletedItem('checkins', c.id, { reason: 'habit-delete', habitId: currentHabitId }));
            
            // 清理时间轴里的打卡记录
            data.records = data.records.filter(r => !(r.isHabitRecord && r.habitId === currentHabitId));
            data.habits = data.habits.filter(h => h.id !== currentHabitId);
            data.checkins = data.checkins.filter(c => c.habitId !== currentHabitId);
            
            currentHabitId = data.habits.length > 0 ? data.habits[0].id : null;
            saveData();
            dualWriteHabitAppLocalMirror('delete-habit');
            renderHabitTabs();
            renderHabitRewards();
            renderHeatmap();
            renderHabitMatrix();
            renderDashboard();
            renderTimeline();
            renderAllRecords();
        }

        // ================== 目标管理 ==================
        function openGoalModal() {
            currentGoalId = null;
            document.getElementById('goal-modal-title').textContent = '新建目标';
            document.getElementById('goal-name').value = '';
            document.getElementById('goal-period').value = '';
            document.getElementById('goal-target').value = '';
            document.getElementById('goal-status').value = '进行中';
            document.getElementById('goal-progress').value = '0';
            document.getElementById('delete-goal-btn').style.display = 'none';
            document.getElementById('goal-modal').classList.add('active');
        }

        function openGoalDetail(goalId) {
            const goal = data.goals.find(g => g.id === goalId);
            if (!goal) return;
            currentGoalId = goalId;
            document.getElementById('goal-modal-title').textContent = '编辑目标';
            document.getElementById('goal-name').value = goal.name || '';
            document.getElementById('goal-period').value = goal.period || '';
            document.getElementById('goal-target').value = goal.target || '';
            document.getElementById('goal-status').value = goal.status || '进行中';
            document.getElementById('goal-progress').value = typeof goal.progress === 'number' ? goal.progress : (goal.status === '已完成' ? 100 : 0);
            document.getElementById('delete-goal-btn').style.display = 'inline-block';
            document.getElementById('goal-modal').classList.add('active');
        }

        function closeGoalModal() {
            document.getElementById('goal-modal').classList.remove('active');
            currentGoalId = null;
            const nameEl = document.getElementById('goal-name');
            const targetEl = document.getElementById('goal-target');
            const progressEl = document.getElementById('goal-progress');
            if (nameEl) nameEl.value = '';
            if (targetEl) targetEl.value = '';
            if (progressEl) progressEl.value = '0';
        }

        function saveGoal() {
            const name = document.getElementById('goal-name').value.trim();
            if (!name) {
                alert('请输入目标名称');
                return;
            }

            const progress = Math.max(0, Math.min(100, parseInt(document.getElementById('goal-progress').value) || 0));
            const goalData = {
                name: name,
                period: document.getElementById('goal-period').value,
                target: document.getElementById('goal-target').value,
                status: document.getElementById('goal-status').value,
                progress: progress
            };

            if (currentGoalId) {
                const goal = data.goals.find(g => g.id === currentGoalId);
                if (goal) Object.assign(goal, goalData);
            } else {
                data.goals.push({
                    id: genId(),
                    ...goalData,
                    createDate: getTodayStr()
                });
            }

            saveData();
            closeGoalModal();
            renderGoalList();
            renderDashboard();
        }

        function renderGoalList() {
            const container = document.getElementById('goal-list');
            if (data.goals.length === 0) {
                container.innerHTML = '<div class="empty-state">暂无目标，点击右上角新建</div>';
                return;
            }

            container.innerHTML = data.goals.map(g => {
                const progress = typeof g.progress === 'number' ? g.progress : (g.status === '已完成' ? 100 : 0);
                return `
                <div class="goal-card" onclick="openGoalDetail(${escapeJsArg(g.id)})">
                    <div class="goal-info">
                        <h4>${escapeHtml(g.name)} <span style="font-size:12px; color:#97a29b; font-weight:700;">(${escapeHtml(g.status)})</span></h4>
                        <p>${escapeHtml(g.period)} · ${escapeHtml(g.target)}</p>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${progress}%"></div>
                        </div>
                    </div>
                    <div style="font-size:20px; font-weight:850; color:#216e4e;">${progress}%</div>
                </div>
            `;
            }).join('');
        }

        function deleteGoal(goalId) {
            if (!confirm('确定删除这个目标吗？')) return;
            const goal = data.goals.find(g => g.id === goalId);
            markDeletedItem('goals', goalId, { reason: 'manual-delete', name: goal?.name || '' });
            data.goals = data.goals.filter(g => g.id !== goalId);
            saveData();
            renderGoalList();
        }

        function deleteCurrentGoal() {
            if (!currentGoalId) return;
            if (!confirm('确定删除这个目标吗？')) return;
            const goal = data.goals.find(g => g.id === currentGoalId);
            markDeletedItem('goals', currentGoalId, { reason: 'manual-delete', name: goal?.name || '' });
            data.goals = data.goals.filter(g => g.id !== currentGoalId);
            saveData();
            closeGoalModal();
            renderGoalList();
            renderDashboard();
        }

        // ================== 数据导入导出 ==================
        function exportData() {
            createLocalSnapshot('手动导出备份');
            downloadJsonFile(`人生规划备份_${getTimestampForFile()}.json`, data);
        }

        function getImportSummary(imported) {
            const collections = ['records', 'todos', 'habits', 'checkins', 'habitPointLedger', 'habitRewards', 'habitCurrencies', 'templates', 'goals', 'materials', 'bodyMetrics', 'fitnessPlans', 'fitnessWorkouts', 'exerciseLibrary', 'wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory'];
            return collections
                .map(key => `${key}:${Array.isArray(imported?.[key]) ? imported[key].length : 0}`)
                .join(' · ');
        }

        function importData() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = e => {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = event => {
                    try {
                        const imported = JSON.parse(event.target.result);
                        normalizeDataShape(imported);
                        const summary = getImportSummary(imported);
                        if (confirm(`导入会安全合并，不会用旧内容静默覆盖当前较新的日记。\n\n如果同一篇日记两边都改过，会保留主版本并创建冲突副本。\n\n备份内容：${summary}\n\n继续导入吗？`)) {
                            const beforeSnapshot = createLocalSnapshot('导入安全合并前', data, {
                                source: 'manual-import',
                                action: 'before-merge',
                                mergedWith: { label: file?.name || '导入文件', hash: getDataHash(imported) }
                            });
                            if (!beforeSnapshot && !confirm('导入前快照创建失败。继续导入会缺少回滚点，确定继续吗？')) return;
                            const previousData = data;
                            data = mergeCloudData(data, imported);
                            createLocalSnapshot('导入安全合并结果', data, {
                                source: 'manual-import',
                                action: 'merge-result',
                                parentSnapshotId: beforeSnapshot?.id,
                                parentVersion: beforeSnapshot?.version,
                                parentHash: beforeSnapshot?.hash,
                                mergedWith: { label: file?.name || '导入文件', hash: getDataHash(imported) }
                            });
                            if (!saveData()) {
                                data = previousData;
                                recordCriticalFailure('导入数据失败', null, { action: 'manual-import', message: '合并后的数据未能写入本地存储' });
                                renderAfterDataChange();
                                alert('导入失败：本地存储写入失败，当前数据已保持不变。请先导出备份或清理存储空间。');
                                return;
                            }
                            init();
                            alert('导入成功：已安全合并，冲突内容会以副本保留。');
                        }
                    } catch(err) {
                        recordCriticalFailure('导入数据失败', err, { action: 'manual-import' });
                        alert('文件格式错误，导入失败');
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        }

        function closeTopModal() {
            const activeModal = Array.from(document.querySelectorAll('.modal-overlay.active')).pop();
            if (!activeModal) return;

            const closeMap = {
                'type-select-modal': closeTypeSelect,
                'record-modal': closeRecordModal,
                'record-preview-modal': closeRecordPreview,
                'habit-modal': closeHabitModal,
                'habit-note-modal': closeHabitNoteModal,
                'habit-reward-modal': closeHabitRewardModal,
                'habit-currency-modal': closeHabitCurrencyModal,
                'habit-point-adjust-modal': closeHabitPointAdjustModal,
                'goal-modal': closeGoalModal,
                'template-modal': closeTemplateManage,
                'todo-detail-modal': closeTodoDetail,
                'snapshot-modal': closeSnapshotModal,
                'material-modal': closeMaterialModal,
                'body-metric-modal': typeof closeBodyMetricModal === 'function' ? closeBodyMetricModal : null,
                'fitness-plan-modal': typeof closeFitnessPlanModal === 'function' ? closeFitnessPlanModal : null,
                'fitness-workout-modal': typeof closeFitnessWorkoutModal === 'function' ? closeFitnessWorkoutModal : null,
                'fitness-live-modal': typeof closeLiveWorkoutModal === 'function' ? closeLiveWorkoutModal : null,
                'fitness-library-modal': typeof closeExerciseLibraryModal === 'function' ? closeExerciseLibraryModal : null,
                'fitness-library-item-modal': typeof closeExerciseLibraryItemModal === 'function' ? closeExerciseLibraryItemModal : null,
                'ai-settings-modal': closeAiSettings,
                'ai-assistant-modal': closeAiAssistant,
                'wheel-create-modal': typeof closeWheelCreateModal === 'function' ? closeWheelCreateModal : null,
                'wheel-batch-modal': typeof closeWheelBatchModal === 'function' ? closeWheelBatchModal : null,
                'wheel-list-modal': typeof closeWheelListModal === 'function' ? closeWheelListModal : null,
                'wheel-items-modal': typeof closeWheelPanelModal === 'function' ? () => closeWheelPanelModal('items') : null,
                'wheel-library-modal': typeof closeWheelPanelModal === 'function' ? () => closeWheelPanelModal('library') : null,
                'wheel-tags-modal': typeof closeWheelPanelModal === 'function' ? () => closeWheelPanelModal('tags') : null,
                'wheel-history-modal': typeof closeWheelPanelModal === 'function' ? () => closeWheelPanelModal('history') : null
            };

            const closeFn = closeMap[activeModal.id];
            if (closeFn) closeFn();
            else activeModal.classList.remove('active');
        }

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeTopModal();
        });

        window.addEventListener('resize', () => updateSidebarToolState());

        // 启动应用
        (async () => {
            init();
            startPeriodicCloudSync();
            startPeriodicWheelCloudSync();
            if (syncConfig.autoSync && syncConfig.webdavUrl) {
                try {
                    await runCloudSync('both');
                } catch (err) {
                    updateSyncStatus(err.message || '自动同步失败', true);
                }
            }
            if (wheelSyncConfig.autoSync && syncConfig.webdavUrl) {
                try {
                    await runWheelCloudSync('both', true);
                } catch (err) {
                    updateWheelSyncStatus(err.message || '大转盘自动同步失败', true);
                }
            }
        })();
