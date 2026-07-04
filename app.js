// ================== 数据层 ==================
        let data = {
            records: [],
            todos: [],
            habits: [],
            checkins: [],
            templates: [],
            goals: [],
            deletedItems: [],
            materials: [],
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
        let currentHabitView = 'year';
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
        let syncConfig = {
            webdavUrl: '',
            username: '',
            password: '',
            remotePath: '/life-plan.json',
            autoSync: true
        };
        let syncState = {
            dirty: false,
            lastLocalHash: '',
            lastRemoteHash: '',
            lastSyncAt: '',
            lastPullAt: '',
            lastPushAt: '',
            lastConflictAt: ''
        };
        let suppressDirtyMark = false;
        let autoSyncTimer = null;
        let syncIntervalTimer = null;
        let isCloudSyncing = false;
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
                        <div class="template-editor-title">${template.name} · 分块填写</div>
                        <div class="template-editor-meta">${template.description || '每一块默认折叠，展开后填写，正文会自动同步生成。'}</div>
                    </div>
                    <div class="template-editor-actions">
                        <button type="button" onclick="toggleTemplateFields(true)">全部展开</button>
                        <button type="button" onclick="toggleTemplateFields(false)">全部收起</button>
                        <button type="button" onclick="clearStructuredTemplateFields()">清空</button>
                    </div>
                </div>
                ${template.fields.map(field => `
                    <details class="template-field">
                        <summary>${field.label}</summary>
                        <textarea
                            rows="${field.rows || 3}"
                            data-template-field="${field.id}"
                            placeholder="${field.placeholder || ''}"
                            oninput="updateStructuredTemplateField('${field.id}', this.value)"
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
            return IDEA_STATUS_OPTIONS.includes(record?.ideaStatus) ? record.ideaStatus : '待整理';
        }

        function getIdeaTags(record) {
            return normalizeTagList(record?.ideaTags);
        }

        function getIdeaTodo(record) {
            return record?.ideaTodoId ? data.todos.find(todo => todo.id === record.ideaTodoId) : null;
        }

        function isIdeaUnprocessed(record) {
            return IDEA_UNPROCESSED_STATUSES.has(getIdeaStatus(record));
        }

        function ideaNeedsConclusion(record) {
            return ['实践中', '已验证'].includes(getIdeaStatus(record)) && !String(record?.ideaConclusion || '').trim();
        }

        // 初始化
        function init() {
            loadData();
            loadSyncState();
            updateSidebarToolState(true);
            renderTodayDate();
            renderDashboard();
            renderHabitTabs();
            initYearSelect();
            if (data.habits.length > 0) {
                currentHabitId = data.habits[0].id;
                renderHeatmap();
            }
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
                localStorage.setItem('lifePlanData', normalized);
            }
            loadSyncConfig();
        }

        function normalizeDataShape(target = data) {
            if (!target || typeof target !== 'object') return data;
            ['records','todos','habits','checkins','templates','goals','deletedItems','materials','wheels','wheelTags','wheelLibraryItems','wheelHistory'].forEach(key => {
                if (!Array.isArray(target[key])) target[key] = [];
            });
            pruneDeletedItems(target);
            target.records = target.records.filter(record => !record?.isHabitRecord);
            target.todos.forEach(t => {
                if (!Array.isArray(t.subTodos)) t.subTodos = [];
                if (!Array.isArray(t.sessions)) t.sessions = [];
                if (!t.group) t.group = '其他';
                if (!TODO_URGENCY_META[t.urgency]) t.urgency = 'medium';
                if (typeof t.dueDate !== 'string') t.dueDate = '';
                if (typeof t.planStartDate !== 'string') t.planStartDate = '';
                if (typeof t.planEndDate !== 'string') t.planEndDate = '';
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
            target.wheels.forEach(wheel => {
                if (!wheel.id) wheel.id = genId();
                if (!wheel.name) wheel.name = '未命名转盘';
                if (wheel.mode !== 'tag') wheel.mode = 'normal';
                if (!Array.isArray(wheel.items)) wheel.items = [];
                wheel.items.forEach(item => {
                    if (!item.id) item.id = genId();
                    if (!item.name) item.name = '未命名选项';
                    item.weight = Math.max(1, Number(item.weight) || 1);
                    if (typeof item.note !== 'string') item.note = '';
                    if (item.enabled === undefined) item.enabled = true;
                });
                if (!wheel.createdAt) wheel.createdAt = getLocalDateTimeStr();
                if (!wheel.updatedAt) wheel.updatedAt = wheel.createdAt;
            });
            target.wheelTags.forEach(tag => {
                if (!tag.id) tag.id = genId();
                if (!tag.name) tag.name = '未命名标签';
                if (!tag.color) tag.color = '#216e4e';
                tag.weight = Math.max(1, Number(tag.weight) || 1);
                if (tag.enabled === undefined) tag.enabled = true;
                if (!tag.createdAt) tag.createdAt = getLocalDateTimeStr();
                if (!tag.updatedAt) tag.updatedAt = tag.createdAt;
            });
            target.wheelLibraryItems.forEach(item => {
                if (!item.id) item.id = genId();
                if (!item.name) item.name = '未命名公共项';
                if (!Array.isArray(item.tagIds)) item.tagIds = [];
                item.weight = Math.max(1, Number(item.weight) || 1);
                if (typeof item.note !== 'string') item.note = '';
                if (item.enabled === undefined) item.enabled = true;
                if (!item.createdAt) item.createdAt = getLocalDateTimeStr();
                if (!item.updatedAt) item.updatedAt = item.createdAt;
            });
            target.wheelHistory.forEach(history => {
                if (!history.id) history.id = genId();
                if (!history.createdAt) history.createdAt = getLocalDateTimeStr();
                if (typeof history.convertedTodoId !== 'string') history.convertedTodoId = '';
            });
            return target;
        }

        function hashString(str) {
            let hash = 2166136261;
            for (let i = 0; i < str.length; i++) {
                hash ^= str.charCodeAt(i);
                hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
            }
            return (hash >>> 0).toString(36);
        }

        function getDataHash(value = data) {
            return hashString(JSON.stringify(value || {}));
        }

        // 保存数据
        function saveData() {
            normalizeDataShape();
            localStorage.setItem('lifePlanData', JSON.stringify(data));
            if (!suppressDirtyMark) {
                syncState.dirty = true;
                syncState.lastLocalHash = getDataHash();
                saveSyncState();
                scheduleAutoCloudSync('本地修改，稍后自动同步');
            }
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
            localStorage.setItem('lifePlanSyncState', JSON.stringify(syncState));
        }

        function saveDataFromSync() {
            suppressDirtyMark = true;
            try {
                saveData();
            } finally {
                suppressDirtyMark = false;
            }
        }

        const SNAPSHOT_KEY = 'lifePlanSnapshots';
        const MAX_LOCAL_SNAPSHOTS = 20;
        const SNAPSHOT_SCHEMA_VERSION = 2;

        function cloneDataSnapshot(value = data) {
            return JSON.parse(JSON.stringify(value || {}));
        }

        function getTimestampForFile(date = new Date()) {
            const pad = n => n.toString().padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
        }

        function getLocalSnapshots() {
            try {
                const saved = localStorage.getItem(SNAPSHOT_KEY);
                const snapshots = saved ? JSON.parse(saved) : [];
                return Array.isArray(snapshots) ? normalizeLocalSnapshots(snapshots) : [];
            } catch (err) {
                console.warn('本地快照读取失败', err);
                return [];
            }
        }

        function normalizeLocalSnapshots(snapshots = []) {
            const sortedOldestFirst = [...snapshots].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
            const fallbackVersions = new Map();
            sortedOldestFirst.forEach((snapshot, index) => {
                fallbackVersions.set(snapshot.id || `${snapshot.createdAt || ''}-${index}`, index + 1);
            });

            return snapshots.map((snapshot, index) => {
                const key = snapshot.id || `${snapshot.createdAt || ''}-${index}`;
                const version = Number(snapshot.version || fallbackVersions.get(key) || 1);
                return {
                    schemaVersion: snapshot.schemaVersion || 1,
                    id: snapshot.id || genId(),
                    version,
                    reason: snapshot.reason || '本地快照',
                    createdAt: snapshot.createdAt || getLocalDateTimeStr(),
                    hash: snapshot.hash || getDataHash(snapshot.data || {}),
                    bytes: snapshot.bytes || new TextEncoder().encode(JSON.stringify(snapshot.data || {})).length,
                    parent: snapshot.parent || null,
                    mergedWith: snapshot.mergedWith || null,
                    source: snapshot.source || 'legacy',
                    action: snapshot.action || '',
                    data: snapshot.data || {}
                };
            });
        }

        function saveLocalSnapshots(snapshots) {
            const limited = normalizeLocalSnapshots(snapshots)
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, MAX_LOCAL_SNAPSHOTS);
            localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(limited));
            return limited;
        }

        function getNextSnapshotVersion(snapshots = getLocalSnapshots()) {
            return snapshots.reduce((max, snapshot) => Math.max(max, Number(snapshot.version || 0)), 0) + 1;
        }

        function getSnapshotParent(snapshots = getLocalSnapshots(), meta = {}) {
            if (meta.parentSnapshotId || meta.parentVersion || meta.parentHash) {
                return {
                    id: meta.parentSnapshotId || '',
                    version: meta.parentVersion || '',
                    hash: meta.parentHash || ''
                };
            }
            const latest = [...snapshots].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
            if (!latest) return null;
            return {
                id: latest.id,
                version: latest.version,
                hash: latest.hash
            };
        }

        function createLocalSnapshot(reason = '自动快照', sourceData = data, meta = {}) {
            let snapshot;

            try {
                const existingSnapshots = getLocalSnapshots();
                const snapshotData = cloneDataSnapshot(sourceData);
                snapshot = {
                    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
                    id: genId(),
                    version: getNextSnapshotVersion(existingSnapshots),
                    reason,
                    createdAt: getLocalDateTimeStr(),
                    hash: getDataHash(snapshotData),
                    bytes: new TextEncoder().encode(JSON.stringify(snapshotData)).length,
                    parent: getSnapshotParent(existingSnapshots, meta),
                    mergedWith: meta.mergedWith || null,
                    source: meta.source || 'local',
                    action: meta.action || '',
                    data: snapshotData
                };
                const snapshots = [snapshot, ...existingSnapshots];
                saveLocalSnapshots(snapshots);
            } catch (err) {
                try {
                    const snapshots = [snapshot, ...getLocalSnapshots()].filter(Boolean);
                    saveLocalSnapshots(snapshots.slice(0, 5));
                } catch (fallbackErr) {
                    console.warn('本地快照写入失败', fallbackErr);
                    updateSyncStatus('本地快照写入失败，可能是浏览器存储空间不足', true);
                    return null;
                }
            }

            renderSnapshotList();
            updateSyncStatus(`已创建本地快照：${reason}`);
            return snapshot;
        }

        function formatBytes(bytes = 0) {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
        }

        function downloadJsonFile(filename, payload) {
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }

        function openSnapshotModal() {
            renderSnapshotList();
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
                goals: snapshotData.goals || [],
                materials: snapshotData.materials || []
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

        function renderSnapshotList() {
            const container = document.getElementById('snapshot-list');
            if (!container) return;
            const snapshots = getLocalSnapshots();
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
                        <button class="btn btn-secondary" onclick="renderSnapshotPreview('${snapshot.id}')">预览</button>
                        <button class="btn btn-secondary" onclick="restoreLocalSnapshot('${snapshot.id}')">恢复</button>
                        <button class="btn btn-secondary" onclick="downloadLocalSnapshot('${snapshot.id}')">下载</button>
                        <button class="btn btn-danger" onclick="deleteLocalSnapshot('${snapshot.id}')">删除</button>
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
            createLocalSnapshot('恢复前自动快照', data, {
                source: 'restore',
                action: 'before-restore',
                mergedWith: { label: `恢复目标 v${snapshot.version || '?'}`, hash: snapshot.hash || '' }
            });
            data = cloneDataSnapshot(snapshot.data);
            saveData();
            renderAfterDataChange();
            closeSnapshotModal();
            updateSyncStatus(`已恢复本地快照：${formatStoredDateTime(snapshot.createdAt)}`);
        }

        function deleteLocalSnapshot(snapshotId) {
            if (!confirm('确定删除这份本地快照吗？')) return;
            saveLocalSnapshots(getLocalSnapshots().filter(item => item.id !== snapshotId));
            renderSnapshotList();
        }

        function renderAfterDataChange() {
            renderDashboard();
            renderAllRecords();
            renderTodoTable();
            renderHabitTabs();
            renderGoalList();
            renderWheelPage();
            refreshKnowledgeViews();
            if (currentHabitId) {
                renderHeatmap();
                if (currentHabitView === 'matrix') renderHabitMatrix();
            }
        }

        function loadSyncConfig() {
            try {
                const saved = localStorage.getItem('lifePlanSyncConfig');
                if (saved) syncConfig = { ...syncConfig, ...JSON.parse(saved) };
            } catch (err) {
                console.warn('同步配置读取失败', err);
            }
            syncConfig.webdavUrl = syncConfig.webdavUrl || '';
            syncConfig.remotePath = syncConfig.remotePath || '/life-plan.json';
            syncConfig.autoSync = syncConfig.autoSync !== false;
            applySyncSettingsToForm();
            updateSyncStatus(syncConfig.webdavUrl ? '已加载云同步配置' : '未配置云同步');
        }

        function saveSyncConfigToLocal() {
            localStorage.setItem('lifePlanSyncConfig', JSON.stringify(syncConfig));
            applySyncSettingsToForm();
        }

        function applySyncSettingsToForm() {
            const ids = ['sync-webdav-url', 'sync-username', 'sync-password', 'sync-remote-path', 'sync-auto'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                if (el.type === 'checkbox') el.checked = !!syncConfig.autoSync;
                else if (id === 'sync-webdav-url') el.value = syncConfig.webdavUrl || '';
                else if (id === 'sync-username') el.value = syncConfig.username || '';
                else if (id === 'sync-password') el.value = syncConfig.password || '';
                else if (id === 'sync-remote-path') el.value = syncConfig.remotePath || '';
            });
        }

        function updateSyncStatus(message, isError = false) {
            const text = message || '';
            const sideEl = document.getElementById('sync-status');
            const modalEl = document.getElementById('sync-modal-status');
            [sideEl, modalEl].forEach(el => {
                if (!el) return;
                el.textContent = text;
                el.classList.toggle('is-error', !!isError);
            });
        }

        function openSyncSettings() {
            applySyncSettingsToForm();
            document.getElementById('sync-modal').classList.add('active');
        }

        function closeSyncSettings() {
            document.getElementById('sync-modal').classList.remove('active');
        }

        function readSyncForm() {
            syncConfig.webdavUrl = document.getElementById('sync-webdav-url').value.trim();
            syncConfig.username = document.getElementById('sync-username').value.trim();
            syncConfig.password = document.getElementById('sync-password').value;
            syncConfig.remotePath = document.getElementById('sync-remote-path').value.trim() || '/life-plan.json';
            syncConfig.autoSync = document.getElementById('sync-auto').checked;
            saveSyncConfigToLocal();
        }

        async function webdavRequest(path, method, body = null) {
            if (!syncConfig.webdavUrl) throw new Error('请先填写 Cloudflare Worker 同步中转地址');
            const base = syncConfig.webdavUrl.replace(/\/+$/, '/');
            const target = String(path || '').replace(/^\/+/, '');
            const url = base + target;
            const headers = {};
            if (body !== null) headers['Content-Type'] = 'application/json; charset=utf-8';
            if (method === 'PROPFIND') headers.Depth = '0';
            const response = await fetch(url, { method, headers, body, mode: 'cors' });
            if (!response.ok && response.status !== 207) {
                const detail = await response.clone().text().catch(() => '');
                const err = new Error(`WebDAV ${method} 失败：${response.status}${detail ? ` ${detail.slice(0, 120)}` : ''}`);
                err.status = response.status;
                err.method = method;
                throw err;
            }
            return response;
        }

        function getItemMergeKey(item, fallbackIndex) {
            if (!item || typeof item !== 'object') return `value-${fallbackIndex}`;
            if (item.id) return `id:${item.id}`;
            if (item.habitId && item.date) return `habit:${item.habitId}:${item.date}`;
            if (item.type && item.period) return `period:${item.type}:${item.period}`;
            if (item.title && item.date) return `title:${item.title}:${item.date}`;
            return `json:${JSON.stringify(item)}`;
        }

        function getItemUpdatedTime(item) {
            if (!item || typeof item !== 'object') return 0;
            const raw = item.updatedAt || item.completedAt || item.createdAt || item.date || item.recordTime || '';
            const time = new Date(raw).getTime();
            return Number.isFinite(time) ? time : 0;
        }

        function getDeletedItemKey(collection, id) {
            return `${collection}:${id}`;
        }

        function markDeletedItem(collection, id, extra = {}) {
            if (!id) return;
            if (!Array.isArray(data.deletedItems)) data.deletedItems = [];
            const key = getDeletedItemKey(collection, id);
            data.deletedItems = data.deletedItems.filter(item => getDeletedItemKey(item.collection, item.id) !== key);
            data.deletedItems.push({
                collection,
                id,
                deletedAt: getLocalDateTimeStr(),
                ...extra
            });
            pruneDeletedItems();
        }

        function pruneDeletedItems(target = data) {
            if (!Array.isArray(target.deletedItems)) target.deletedItems = [];
            const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
            target.deletedItems = target.deletedItems.filter(item => {
                const time = new Date(item.deletedAt || 0).getTime();
                return !Number.isFinite(time) || time >= cutoff;
            });
        }

        function buildDeletionMap(localData = data, remoteData = {}) {
            const map = new Map();
            [...(localData.deletedItems || []), ...(remoteData.deletedItems || [])].forEach(item => {
                if (!item?.collection || !item?.id) return;
                const key = getDeletedItemKey(item.collection, item.id);
                const existing = map.get(key);
                if (!existing || new Date(item.deletedAt || 0) > new Date(existing.deletedAt || 0)) {
                    map.set(key, item);
                }
            });
            return map;
        }

        function shouldKeepMergedItem(collection, item, deletionMap) {
            if (!item?.id) return true;
            const deleted = deletionMap.get(getDeletedItemKey(collection, item.id));
            if (!deleted) return true;
            return getItemUpdatedTime(item) > new Date(deleted.deletedAt || 0).getTime();
        }

        function mergeArrayByIdentity(collection, localItems = [], remoteItems = [], deletionMap = new Map()) {
            const merged = new Map();
            localItems.forEach((item, index) => merged.set(getItemMergeKey(item, index), item));
            remoteItems.forEach((remoteItem, index) => {
                const key = getItemMergeKey(remoteItem, index);
                const localItem = merged.get(key);
                if (!localItem || getItemUpdatedTime(remoteItem) >= getItemUpdatedTime(localItem)) {
                    merged.set(key, remoteItem);
                }
            });
            return Array.from(merged.values()).filter(item => shouldKeepMergedItem(collection, item, deletionMap));
        }

        function mergeCloudData(localData, remoteData) {
            const merged = { ...localData, ...remoteData };
            const deletionMap = buildDeletionMap(localData, remoteData);
            ['records', 'todos', 'habits', 'checkins', 'templates', 'goals', 'materials', 'wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory'].forEach(key => {
                merged[key] = mergeArrayByIdentity(key, localData[key] || [], remoteData[key] || [], deletionMap);
            });
            merged.deletedItems = Array.from(deletionMap.values());
            pruneDeletedItems(merged);
            return merged;
        }

        async function fetchRemoteData() {
            let response;
            try {
                response = await webdavRequest(syncConfig.remotePath, 'GET');
            } catch (err) {
                if (err.status === 404) return null;
                throw err;
            }
            const text = await response.text();
            if (!text.trim()) return null;
            const remoteData = JSON.parse(text);
            return { data: remoteData, hash: getDataHash(remoteData) };
        }

        async function syncDownFromCloud() {
            const remote = await fetchRemoteData();
            if (!remote) return false;
            const localHash = getDataHash();
            const localChanged = syncState.dirty || (!!syncState.lastRemoteHash && localHash !== syncState.lastRemoteHash) || (!syncState.lastRemoteHash && localHash !== remote.hash);
            const shouldMerge = localChanged && localHash !== remote.hash;
            let beforeSnapshot = null;
            if (shouldMerge) {
                beforeSnapshot = createLocalSnapshot('手动拉取合并前', data, {
                    source: 'cloud-pull',
                    action: 'before-merge',
                    mergedWith: { label: '云端', hash: remote.hash }
                });
            } else if (localHash !== remote.hash) {
                beforeSnapshot = createLocalSnapshot('手动拉取覆盖前', data, {
                    source: 'cloud-pull',
                    action: 'before-overwrite',
                    mergedWith: { label: '云端', hash: remote.hash }
                });
            }
            data = shouldMerge ? mergeCloudData(data, remote.data) : remote.data;
            if (shouldMerge) {
                createLocalSnapshot('手动拉取合并结果', data, {
                    source: 'cloud-pull',
                    action: 'merge-result',
                    parentSnapshotId: beforeSnapshot?.id,
                    parentVersion: beforeSnapshot?.version,
                    parentHash: beforeSnapshot?.hash,
                    mergedWith: { label: '云端', hash: remote.hash }
                });
            }
            saveDataFromSync();
            syncState.dirty = shouldMerge;
            syncState.lastRemoteHash = remote.hash;
            syncState.lastPullAt = new Date().toISOString();
            if (!shouldMerge) syncState.lastSyncAt = syncState.lastPullAt;
            saveSyncState();
            return shouldMerge ? 'merged' : 'pulled';
        }

        async function syncUpToCloud(force = false) {
            const localHash = getDataHash();
            if (!force && !syncState.dirty && syncState.lastRemoteHash === localHash) return false;
            createLocalSnapshot('上传云端前', data, {
                source: 'cloud-push',
                action: force ? 'force-upload' : 'upload',
                mergedWith: syncState.lastRemoteHash ? { label: '上次云端', hash: syncState.lastRemoteHash } : null
            });
            const remotePath = syncConfig.remotePath.startsWith('/') ? syncConfig.remotePath : `/${syncConfig.remotePath}`;
            const folderPath = remotePath.split('/').slice(0, -1).join('/');
            if (folderPath) {
                try { await webdavRequest(folderPath, 'MKCOL'); } catch (err) {}
            }
            await webdavRequest(remotePath, 'PUT', JSON.stringify(data, null, 2));
            syncState.dirty = false;
            syncState.lastRemoteHash = localHash;
            syncState.lastPushAt = new Date().toISOString();
            syncState.lastSyncAt = syncState.lastPushAt;
            saveSyncState();
            return true;
        }

        async function runCloudSync(direction = 'both') {
            if (isCloudSyncing) {
                updateSyncStatus('已有同步任务进行中，稍等一下。');
                return;
            }
            try {
                isCloudSyncing = true;
                readSyncForm();
                updateSyncStatus(`正在同步... ${formatClockTime(new Date(), true)}`);

                if (direction === 'up') {
                    const remote = await fetchRemoteData();
                    const localHash = getDataHash();
                    const remoteChanged = remote && remote.hash !== localHash && (!syncState.lastRemoteHash || remote.hash !== syncState.lastRemoteHash);
                    if (remoteChanged) {
                        const beforeSnapshot = createLocalSnapshot('手动上传合并前', data, {
                            source: 'cloud-push',
                            action: 'before-merge',
                            mergedWith: { label: '云端', hash: remote.hash }
                        });
                        data = mergeCloudData(data, remote.data);
                        createLocalSnapshot('手动上传合并结果', data, {
                            source: 'cloud-push',
                            action: 'merge-result',
                            parentSnapshotId: beforeSnapshot?.id,
                            parentVersion: beforeSnapshot?.version,
                            parentHash: beforeSnapshot?.hash,
                            mergedWith: { label: '云端', hash: remote.hash }
                        });
                        saveDataFromSync();
                        syncState.dirty = true;
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
                const localHash = getDataHash();
                const remoteHash = remote ? remote.hash : '';
                const localChanged = syncState.dirty || (!!syncState.lastRemoteHash && localHash !== syncState.lastRemoteHash) || !syncState.lastRemoteHash;
                const remoteChanged = remote && syncState.lastRemoteHash && remoteHash !== syncState.lastRemoteHash;

                if (!remote) {
                    await syncUpToCloud(true);
                    updateSyncStatus(`云端无文件，已上传本地数据 ${formatClockTime(new Date(), true)}`);
                    return;
                }

                if (!localChanged && !remoteChanged) {
                    syncState.lastPullAt = new Date().toISOString();
                    saveSyncState();
                    updateSyncStatus(`云端和本地一致，无需同步 ${formatClockTime(new Date(), true)}`);
                    return;
                }

                if (!localChanged && remoteHash !== localHash) {
                    createLocalSnapshot('拉取云端覆盖前', data, {
                        source: 'auto-sync',
                        action: 'before-overwrite',
                        mergedWith: { label: '云端', hash: remoteHash }
                    });
                    data = remote.data;
                    saveDataFromSync();
                    syncState.dirty = false;
                    syncState.lastRemoteHash = remoteHash;
                    syncState.lastPullAt = new Date().toISOString();
                    syncState.lastSyncAt = syncState.lastPullAt;
                    saveSyncState();
                    renderAfterDataChange();
                    updateSyncStatus(`发现云端更新，已拉取 ${formatClockTime(new Date(), true)}`);
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
                data = mergeCloudData(data, remote.data);
                createLocalSnapshot('自动合并结果', data, {
                    source: 'auto-sync',
                    action: 'merge-result',
                    parentSnapshotId: beforeSnapshot?.id,
                    parentVersion: beforeSnapshot?.version,
                    parentHash: beforeSnapshot?.hash,
                    mergedWith: { label: '云端', hash: remote.hash }
                });
                saveDataFromSync();
                syncState.dirty = true;
                syncState.lastConflictAt = new Date().toISOString();
                await syncUpToCloud(true);
                renderAfterDataChange();
                updateSyncStatus(`本地和云端都有变化，已按条目时间保守合并 ${formatClockTime(new Date(), true)}`);
            } catch (err) {
                updateSyncStatus(err.message || '同步失败', true);
                throw err;
            } finally {
                isCloudSyncing = false;
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
        });

        async function testCloudSync() {
            try {
                readSyncForm();
                updateSyncStatus('正在测试连接...');
                const remotePath = syncConfig.remotePath.startsWith('/') ? syncConfig.remotePath : `/${syncConfig.remotePath}`;
                const folderPath = remotePath.split('/').slice(0, -1).join('/') || '/';
                try {
                    await webdavRequest(folderPath, 'PROPFIND');
                } catch (err) {
                    if (err.status === 404) updateSyncStatus('连接成功，云端目录还不存在，首次上传会自动创建');
                    else throw err;
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

        // 生成ID
        function genId() {
            return Date.now().toString(36) + Math.random().toString(36).slice(2);
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
            const duration = endMinutes && startMinutes !== null && endMinutes > startMinutes ? endMinutes - startMinutes : 60;
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
                endMinutes: startMinutes === null ? null : Math.min(startMinutes + duration, 23 * 60 + 59),
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
            const duration = endMinutes && startMinutes !== null && endMinutes > startMinutes ? endMinutes - startMinutes : 45;
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
                endMinutes: startMinutes === null ? null : Math.min(startMinutes + duration, 23 * 60 + 59),
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
                endMinutes: count > 0 && startMinutes !== null ? Math.min(startMinutes + 30, 23 * 60 + 59) : null,
                timeLabel: count > 0 ? (checkinTime || '已打卡') : '待打卡',
                click: `focusHabitFromSchedule('${habit.id}')`,
                habitTag: habit.tag,
                tone
            };
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
                getDateRangeArray(startDate, endDate).forEach(dateStr => {
                    data.habits.forEach(habit => {
                        if (!isHabitDueOnDate(habit, dateStr)) return;
                        const item = buildHabitScheduleItem(habit, dateStr);
                        if (!item.done) return;
                        const haystack = [item.type, item.title, item.preview, item.meta, item.date].filter(Boolean).join(' ').toLowerCase();
                        if (!keywordText || haystack.includes(keywordText)) items.push(item);
                    });
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
                return (b.endMinutes || b.startMinutes + 60) - (a.endMinutes || a.startMinutes + 60);
            });
            const clusters = [];
            let current = [];
            let clusterEnd = -1;

            sorted.forEach(item => {
                const itemEnd = item.endMinutes || item.startMinutes + 60;
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
                    const itemEnd = item.endMinutes || item.startMinutes + 60;
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

        const TODO_URGENCY_META = {
            urgent: { label: '紧急', rank: 4 },
            high: { label: '高', rank: 3 },
            medium: { label: '中', rank: 2 },
            low: { label: '低', rank: 1 }
        };

        function getTodoUrgencyMeta(todoOrUrgency) {
            const urgency = typeof todoOrUrgency === 'string'
                ? todoOrUrgency
                : todoOrUrgency?.urgency;
            return TODO_URGENCY_META[urgency] || TODO_URGENCY_META.medium;
        }

        function getTodoSortDate(todo) {
            return todo?.dueDate || '9999-12-31';
        }

        function compareTodosForFocus(a, b) {
            if (!!a.done !== !!b.done) return a.done ? 1 : -1;
            const urgencyDiff = getTodoUrgencyMeta(b).rank - getTodoUrgencyMeta(a).rank;
            if (urgencyDiff) return urgencyDiff;
            return getTodoSortDate(a).localeCompare(getTodoSortDate(b));
        }

        function formatTodoDueDate(todo) {
            return todo?.dueDate || '无截止';
        }

        function getTodoPlanLabel(todo) {
            if (todo?.planStartDate && todo?.planEndDate) {
                return todo.planStartDate === todo.planEndDate
                    ? `计划 ${formatDate(todo.planStartDate)}`
                    : `计划 ${formatDate(todo.planStartDate)} ~ ${formatDate(todo.planEndDate)}`;
            }
            return '未设置计划周期';
        }

        function isTodoInDateRange(todo, start, end) {
            if (!start && !end) return true;
            const rangeStart = start || '0000-00-00';
            const rangeEnd = end || '9999-12-31';
            if (todo.dueDate && todo.dueDate >= rangeStart && todo.dueDate <= rangeEnd) return true;
            if (todo.planStartDate && todo.planEndDate && todo.planStartDate <= rangeEnd && todo.planEndDate >= rangeStart) return true;
            return (todo.sessions || []).some(session => session.date && session.date >= rangeStart && session.date <= rangeEnd);
        }

        function renderTodoUrgencyBadge(todo) {
            const meta = getTodoUrgencyMeta(todo);
            const urgency = todo?.urgency || 'medium';
            return `<span class="todo-urgency todo-urgency-${urgency}">${meta.label}</span>`;
        }

        function getRecordDateRangeLabel(record) {
            const start = record.startDate ? formatDate(record.startDate) : '';
            const end = record.endDate ? formatDate(record.endDate) : '';
            if (start && end && start !== end) return `${start} ~ ${end}`;
            return start || end || '未设置日期';
        }

        function parseRecordContentSections(content = '') {
            const lines = String(content || '').replace(/\r/g, '').split('\n');
            const sections = [];
            let current = null;

            lines.forEach(line => {
                const trimmed = line.trim();
                if (/^#\s+/.test(trimmed)) {
                    if (current) sections.push(current);
                    current = { title: trimmed.replace(/^#\s+/, ''), body: [] };
                    return;
                }

                if (!current) current = { title: '内容', body: [] };
                current.body.push(line);
            });

            if (current) sections.push(current);
            return sections.filter(section => section.title || section.body.join('').trim());
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
            const today = new Date(baseDate);
            const todayStr = formatLocalDateKey(today);

            switch(type) {
                case '日记':
                case '日计划':
                case '工作记录':
                case '灵感碎片':
                    return { start: todayStr, end: todayStr };
                case '周复盘':
                case '周计划': {
                    const day = today.getDay() || 7;
                    const monday = new Date(today);
                    monday.setDate(today.getDate() - day + 1);
                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    return {
                        start: formatLocalDateKey(monday),
                        end: formatLocalDateKey(sunday)
                    };
                }
                case '月复盘':
                case '月计划': {
                    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    return {
                        start: formatLocalDateKey(monthStart),
                        end: formatLocalDateKey(monthEnd)
                    };
                }
                case '年复盘':
                case '年度计划': {
                    const yearStart = new Date(today.getFullYear(), 0, 1);
                    const yearEnd = new Date(today.getFullYear(), 11, 31);
                    return {
                        start: formatLocalDateKey(yearStart),
                        end: formatLocalDateKey(yearEnd)
                    };
                }
                case '3年计划': {
                    const yearStart3 = new Date(today.getFullYear(), 0, 1);
                    const yearEnd3 = new Date(today.getFullYear() + 2, 11, 31);
                    return {
                        start: formatLocalDateKey(yearStart3),
                        end: formatLocalDateKey(yearEnd3)
                    };
                }
                case '终身愿景':
                    return { start: todayStr, end: '' };
                default:
                    return { start: todayStr, end: todayStr };
            }
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
            if (pageName === 'habits') { renderHabitTabs(); if(currentHabitId) renderHeatmap(); if(currentHabitView === 'matrix') renderHabitMatrix(); }
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

            document.getElementById('summary-todos').textContent = `${todayTodoDone}/${todayTodos.length}`;
            document.getElementById('summary-habits').textContent = `${doneHabits}/${dueHabits.length}`;
            document.getElementById('summary-goals').textContent = activeGoals;
            document.getElementById('summary-records').textContent = weekRecords;
            document.getElementById('hero-title').textContent = nextTodo ? `今天先处理：${nextTodo.text}` : '今天先把最重要的事推进一点';
            document.getElementById('hero-meta').innerHTML = [
                `待办 ${todayTodoDone}/${todayTodos.length}`,
                `习惯 ${doneHabits}/${dueHabits.length}`,
                `进行中目标 ${activeGoals}`,
                `本周记录 ${weekRecords}`
            ].map(text => `<span>${text}</span>`).join('');
        }

        function getDashboardMaterialPicks() {
            return [...data.materials]
                .sort(() => Math.random() - 0.5)
                .slice(0, 2);
        }

        function renderGoalFocusList() {
            const goals = [...data.goals]
                .filter(goal => goal.status === '进行中')
                .sort((a, b) => Number(b.progress || 0) - Number(a.progress || 0))
                .slice(0, 3);
            if (!goals.length) return '<div class="empty-state compact-empty">暂无进行中的目标</div>';
            return goals.map(goal => `
                <div class="command-row" onclick="openGoalDetail('${goal.id}')">
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
                                <div class="command-row" onclick="openTodoDetail('${todo.id}')">
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
            return (todo.sessions || []).some(session => session.date === dateStr);
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
                            <input type="checkbox" onchange="toggleTodo('${t.id}'); renderDashboard();">
                            <span class="todo-text" onclick="openTodoDetail('${t.id}')">
                                ${escapeHtml(t.text)}
                                <small>${escapeHtml(getTodayTodoReason(t))}</small>
                            </span>
                            ${renderTodoUrgencyBadge(t)}
                            <span class="todo-actions">
                                <button class="btn btn-secondary todo-mini-btn" onclick="addQuickTodoSession('${t.id}')">执行一次</button>
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
                picked.sort(() => Math.random() - 0.5);
            }
            picked = picked.slice(0, 5);

            container.innerHTML = `
                <ul class="todo-list">
                    ${picked.map(t => `
                        <li class="todo-item">
                            <input type="checkbox" onchange="toggleTodo('${t.id}'); renderDashboard();">
                            <span class="todo-text" onclick="openTodoDetail('${t.id}')">
                                ${escapeHtml(t.text)}
                                <small>无截止 · 可转入今天</small>
                            </span>
                            ${renderTodoUrgencyBadge(t)}
                            <span class="todo-actions">
                                <button class="btn btn-secondary todo-mini-btn" onclick="planTodoForToday('${t.id}')">今天做</button>
                                <button class="btn btn-secondary todo-mini-btn" onclick="addQuickTodoSession('${t.id}')">执行一次</button>
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
                const latestNote = getCheckinNoteSummary(latestCheckin?.note, 40);
                const statusClass = doneCount === 0 ? 'is-pending' : (doneCount >= targetCount ? 'is-done' : 'is-active');
                const statusText = doneCount === 0
                    ? '待开始'
                    : (doneCount >= targetCount ? '今日达标' : `进行中 ${doneCount}/${targetCount}`);
                const infoParts = [
                    getHabitRuleText(habit),
                    `${doneCount}/${targetCount}`,
                    latestTime || '未记录'
                ];
                const primaryActionText = targetCount > 1 && doneCount > 0 ? '再记一次' : '打卡';
                const actionButtons = doneCount === 0
                    ? `
                        <button class="habit-quick-btn primary" onclick="quickHabitCheckin('${habit.id}')">${primaryActionText}</button>
                        <button class="habit-quick-btn secondary" onclick="quickHabitCheckinWithNote('${habit.id}')">备注</button>
                    `
                    : targetCount === 1
                        ? `
                            <button class="habit-quick-btn secondary" onclick="quickHabitCheckin('${habit.id}')">备注</button>
                            <button class="habit-quick-btn ghost" onclick="quickUndoHabitCheckin('${habit.id}')">撤销</button>
                        `
                        : `
                            <button class="habit-quick-btn primary" onclick="quickHabitCheckin('${habit.id}')">打卡</button>
                            <button class="habit-quick-btn secondary" onclick="${latestCheckin ? `editLatestHabitNote('${habit.id}')` : `quickHabitCheckinWithNote('${habit.id}')`}">备注</button>
                            <button class="habit-quick-btn ghost" onclick="quickDecreaseHabitCheckin('${habit.id}')">-1</button>
                        `;

                return `
                    <article class="habit-quick-card ${doneCount > 0 ? 'done' : ''} ${targetCount > 1 ? 'multi' : ''}">
                        <div class="habit-quick-head">
                            <div class="habit-quick-main">
                                <div class="habit-quick-title-row">
                                    <div class="habit-quick-title">${escapeHtml(habit.name)}</div>
                                    <span class="habit-quick-tag">${escapeHtml(habit.tag || '习惯')}</span>
                                    <span class="habit-quick-status ${statusClass}">${escapeHtml(statusText)}</span>
                                </div>
                                <div class="habit-quick-meta">${infoParts.map(part => `<span>${escapeHtml(part)}</span>`).join('')}</div>
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
                return `
                    <div class="period-item" onclick="openRecordPreview('${r.id}')">
                        <div class="period-info">
                            <h4><span class="item-type type-${r.type}" style="margin-right:8px;">${r.type}</span>${r.title || '无标题'}</h4>
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
            return `
                <div class="idea-badge-row">
                    <span class="idea-status-badge status-${getIdeaStatus(record)}">${escapeHtml(getIdeaStatus(record))}</span>
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
            return `
                <div class="record-row">
                    <div class="record-time">${getRecordTime(record)}</div>
                    <div class="timeline-item type-${record.type}" onclick="openRecordPreview('${record.id}')">
                        <span class="item-type type-${record.type}">${record.type}</span>
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
            const metaParts = [item.meta, item.sourceType === 'todo' && item.done ? '已完成' : '', item.sourceType === 'habit' ? item.timeLabel : ''].filter(Boolean);
            const toneStyle = `--event-bg:${item.tone.bg}; --event-border:${item.tone.border}; --event-ink:${item.tone.ink};`;
            return `
                <div class="record-row">
                    <div class="record-time">${item.allDay ? item.timeLabel : formatMinutesLabel(item.startMinutes)}</div>
                    <div class="timeline-item type-${label}" style="${toneStyle}" onclick="${item.click}">
                        <span class="item-type type-${label}">${label}</span>
                        <span class="item-title">${escapeHtml(item.title || '未命名')}</span>
                        ${metaParts.length ? `<div class="item-meta">${metaParts.map(part => `<span>${escapeHtml(part)}</span>`).join('')}</div>` : ''}
                        ${preview}
                    </div>
                </div>
            `;
        }

        function focusHabitFromSchedule(habitId) {
            currentHabitId = habitId;
            const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent.includes('习惯热力图'));
            switchPage('habits', navEl);
            renderHabitTabs();
            if (currentHabitView === 'matrix') renderHabitMatrix();
            else renderHeatmap();
        }

        function renderTimeline() {
            const container = document.getElementById('timeline');
            const today = getTodayStr();
            const start = addDays(today, -6);
            const items = buildScheduleItemsForRange(start, today, {
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

            const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a)).slice(0, 7);

            if (sortedDates.length === 0) {
                container.innerHTML = '<div class="empty-state">暂无记录，点击右上角新建第一条吧</div>';
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
                        <span class="item-type type-${record.type}">${record.type}</span>
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
                                    <button class="btn btn-secondary todo-mini-btn" onclick="convertIdeaToTodo('${record.id}')">${getIdeaTodo(record) ? '打开关联待办' : '转成待办'}</button>
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
                            : `<button class="btn btn-secondary" onclick="editRecordFromPreview()">编辑</button>`}
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
                    <span class="todo-text">${t.text}</span>
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
                <option value="${todo.id}" ${todo.id === selectedId ? 'selected' : ''}>${escapeHtml(todo.text || '未命名待办')}</option>
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

        function getFilteredRecords() {
            const keyword = (document.getElementById('record-search')?.value || '').trim().toLowerCase();
            const typeFilter = document.getElementById('record-type-filter')?.value || 'all';
            const ideaStatusFilter = document.getElementById('record-idea-status-filter')?.value || 'all';
            const ideaTagFilter = document.getElementById('record-idea-tag-filter')?.value || '';
            return [...data.records]
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

        function getViewScheduleItems(startDate, endDate) {
            return buildScheduleItemsForRange(startDate, endDate, {
                ...getRecordViewFilters(),
                includeRecords: true,
                includeTodos: true,
                includeHabits: true
            });
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
            const hourHeight = 64;
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
                <div class="agenda-shell">
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
                                                const height = Math.max(((item.endMinutes || item.startMinutes + 60) - item.startMinutes) * hourHeight / 60, 38);
                                                const gap = 4;
                                                const columnCount = item.layoutColumns || 1;
                                                const columnIndex = item.layoutColumn || 0;
                                                const width = `calc((100% - 16px - ${gap * (columnCount - 1)}px) / ${columnCount})`;
                                                const left = `calc(8px + (${width} + ${gap}px) * ${columnIndex})`;
                                                return `
                                                    <div class="agenda-event-block ${item.done ? 'is-done' : ''}" style="${toneStyle}; top:${top}px; height:${height}px; left:${left}; width:${width};" onclick="${item.click}">
                                                        <div class="agenda-event-time">${formatMinutesLabel(item.startMinutes)}${item.endMinutes ? ` - ${formatMinutesLabel(item.endMinutes)}` : ''}</div>
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
            const records = getFilteredRecords();

            if (currentRecordView === 'list') {
                document.getElementById('record-view-title').textContent = '全部记录';
                container.innerHTML = renderRecordGroups(records);
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
            return data.records
                .filter(record => record.type === '灵感碎片')
                .filter(record => {
                    if (statusFilter === 'unprocessed') return isIdeaUnprocessed(record);
                    if (statusFilter === 'needsConclusion') return ideaNeedsConclusion(record);
                    if (statusFilter !== 'all') return getIdeaStatus(record) === statusFilter;
                    return true;
                })
                .filter(record => hasMatchingTag(getIdeaTags(record), tagFilter))
                .filter(record => {
                    if (!keyword) return true;
                    return [record.title, record.content, record.ideaNextAction, record.ideaConclusion, getIdeaStatus(record), ...getIdeaTags(record)]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase()
                        .includes(keyword);
                })
                .sort((a, b) => getRecordSortValue(b).localeCompare(getRecordSortValue(a)));
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
                return `
                    <article class="idea-card">
                        <div class="idea-card-head">
                            <span class="item-type type-灵感碎片">灵感碎片</span>
                            ${renderIdeaBadges(record)}
                        </div>
                        <h3>${escapeHtml(record.title || '未命名灵感')}</h3>
                        <div class="idea-card-preview">${escapeHtml((record.content || '').replace(/\n/g, ' ')) || '还没有正文'}</div>
                        <div class="idea-detail-grid compact">
                            <div><strong>下一步</strong><span>${escapeHtml(record.ideaNextAction || '未设置')}</span></div>
                            <div><strong>关联待办</strong><span>${escapeHtml(todo?.text || '未关联')}</span></div>
                            <div class="wide"><strong>结论</strong><span>${escapeHtml(record.ideaConclusion || '还没有结论')}</span></div>
                        </div>
                        <div class="idea-card-actions">
                            <button class="btn btn-secondary todo-mini-btn" onclick="openRecordPreview('${record.id}')">查看</button>
                            <button class="btn btn-secondary todo-mini-btn" onclick="convertIdeaToTodo('${record.id}')">${todo ? '打开待办' : '转成待办'}</button>
                            <button class="btn btn-primary todo-mini-btn" onclick="openRecordModal('${record.id}')">编辑推进</button>
                        </div>
                    </article>
                `;
            }).join('')}</div>`;
        }

        function getIdeaTodoText(record) {
            return (record.ideaNextAction || record.title || record.content || '实践一条灵感')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 120) || '实践一条灵感';
        }

        function convertIdeaToTodo(recordId) {
            const record = data.records.find(item => item.id === recordId && item.type === '灵感碎片');
            if (!record) return;
            const existingTodo = getIdeaTodo(record);
            if (existingTodo) {
                openTodoDetail(existingTodo.id);
                return;
            }

            const now = getLocalDateTimeStr();
            const todo = {
                id: genId(),
                text: getIdeaTodoText(record),
                planStartDate: '',
                planEndDate: '',
                dueDate: '',
                urgency: 'medium',
                group: '学习',
                done: false,
                subTodos: [],
                sessions: [],
                isExclusive: false,
                createdAt: now,
                updatedAt: now,
                completedAt: ''
            };
            data.todos.push(todo);
            record.ideaTodoId = todo.id;
            if (getIdeaStatus(record) === '待整理') record.ideaStatus = '待实践';
            record.updatedAt = now;
            saveData();
            renderIdeaPool();
            renderAllRecords();
            renderDashboard();
            renderGlobalSearch();
            openTodoDetail(todo.id);
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
                            <button class="btn btn-secondary todo-mini-btn" onclick="openMaterialModal('${material.id}')">编辑</button>
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
            return [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
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

        // ================== 模板管理 ==================
        function refreshTemplateSelect(type) {
            const select = document.getElementById('template-select');
            const typeTemplates = data.templates.filter(t => t.type === type);
            const builtIns = builtInTemplates.filter(t => t.type === type);
            
            const builtInOptions = builtIns.length
                ? `<optgroup label="内置模板">${builtIns.map(t => `<option value="builtin:${t.id}">${t.name}</option>`).join('')}</optgroup>`
                : '';
            const customOptions = typeTemplates.length
                ? `<optgroup label="我的模板">${typeTemplates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</optgroup>`
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
                            <div style="font-size:14px; font-weight:500;">${t.name}</div>
                            <div style="font-size:12px; color:#999;">${t.type}</div>
                        </div>
                        <button class="btn btn-danger" style="padding:4px 10px; font-size:12px;" onclick="deleteTemplate('${t.id}')">删除</button>
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
            data.templates = data.templates.filter(t => t.id !== id);
            saveData();
            openTemplateManage();
        }

        // ================== 待办总览 ==================
        function toggleTodo(todoId) {
            const todo = data.todos.find(t => t.id === todoId);
            if (todo) {
                todo.done = !todo.done;
                todo.completedAt = todo.done ? getLocalDateTimeStr() : '';
                todo.updatedAt = getLocalDateTimeStr();
                saveData();
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
                            onchange="toggleTodo('${t.id}'); renderTodoTable();"></td>
                        <td class="todo-title-cell ${t.done ? 'is-done' : ''}" onclick="openTodoDetail('${t.id}')">
                            ${escapeHtml(t.text)}
                            ${t.subTodos && t.subTodos.length > 0 ? `<span style="color:#999; font-size:12px;">(${t.subTodos.filter(s=>s.done).length}/${t.subTodos.length})</span>` : ''}
                            <div class="todo-title-meta">${escapeHtml(getTodoPlanLabel(t))} · 执行 ${sessionCount} 次</div>
                        </td>
                        <td><span class="${dueClass}">${escapeHtml(formatTodoDueDate(t))}</span></td>
                        <td>${renderTodoUrgencyBadge(t)}</td>
                        <td><span class="tag tag-${t.group}">${escapeHtml(t.group)}</span></td>
                        <td>${t.isExclusive ? '专属' : '通用'}</td>
                        <td style="font-size:12px; color:#666;">${escapeHtml(recordNames || '无归属')}</td>
                    </tr>
                `;
            }).join('');
        }

        function openTodoModal() {
            currentTodoId = null;
            document.getElementById('todo-detail-text').value = '';
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
        }

        let tempSubTodos = [];
        let tempTodoSessions = [];
        let currentTodoDetailMode = 'view';

        function loadTodoDetailForm(todo) {
            document.getElementById('todo-detail-text').value = todo.text || '';
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
                    <div class="todo-detail-note">查看模式下不会误改内容；执行记录可直接“执行一次”或“删本次”，计划和子任务需要点“编辑”。</div>
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
                ? (isExisting ? '编辑待办' : '新建待办')
                : '待办详情';
            document.getElementById('todo-detail-view').style.display = isEdit ? 'none' : '';
            document.getElementById('todo-detail-edit-panel').style.display = isEdit ? '' : 'none';
            document.getElementById('todo-session-editor').style.display = (isEdit && isExisting) ? '' : 'none';
            document.getElementById('todo-subtodo-add').style.display = isEdit ? '' : 'none';
            document.getElementById('todo-detail-view-actions').style.display = (!isEdit && isExisting) ? '' : 'none';
            document.getElementById('todo-detail-edit-actions').style.display = isEdit ? '' : 'none';
            document.querySelectorAll('#todo-detail-edit-actions .btn-danger, #todo-detail-view-actions .btn-danger')
                .forEach(btn => { btn.style.display = isExisting ? '' : 'none'; });

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
                    <button class="btn btn-secondary" onclick="deleteTodoSession('${session.id}')">删本次</button>
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
                <li class="todo-item ${s.done ? 'done' : ''}">
                    <input type="checkbox" ${s.done ? 'checked' : ''} ${canEdit ? `onchange="tempSubTodos[${i}].done = !tempSubTodos[${i}].done; renderSubTodos();"` : 'disabled'}>
                    <span class="todo-text">${escapeHtml(s.text)}</span>
                    ${canEdit ? `<button class="btn btn-secondary todo-mini-btn" onclick="tempSubTodos.splice(${i},1); renderSubTodos();">删除</button>` : ''}
                </li>
            `).join('');
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

            let planStartDate = document.getElementById('todo-detail-plan-start').value;
            let planEndDate = document.getElementById('todo-detail-plan-end').value;
            if (planStartDate && !planEndDate) planEndDate = planStartDate;
            if (!planStartDate && planEndDate) planStartDate = planEndDate;
            if (planStartDate && planEndDate && planStartDate > planEndDate) {
                alert('计划结束日期不能早于计划开始日期');
                return;
            }

            const todoData = {
                text: text,
                planStartDate,
                planEndDate,
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
            if (todoData.subTodos && todoData.subTodos.length > 0) {
                const allDone = todoData.subTodos.every(s => s.done);
                const target = currentTodoId 
                    ? data.todos.find(t => t.id === currentTodoId) 
                    : data.todos[data.todos.length - 1];
                if (target) target.done = allDone;
            }

            saveData();
            closeTodoDetail();
            renderTodoTable();
            renderDashboard();
            renderAllRecords();
            refreshKnowledgeViews();
        }

        function deleteCurrentTodo() {
            if (!currentTodoId) return;
            if (!confirm('确定删除这个待办吗？')) return;
            
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
        // ================== 习惯热力图 ==================
        function setHabitView(view, button) {
            currentHabitView = view;
            document.querySelectorAll('#habit-view-tabs button').forEach(btn => btn.classList.remove('active'));
            if (button) button.classList.add('active');
            document.getElementById('habit-view-year').classList.toggle('active', view === 'year');
            document.getElementById('habit-view-matrix').classList.toggle('active', view === 'matrix');
            if (view === 'matrix') renderHabitMatrix();
            if (view === 'year' && currentHabitId) renderHeatmap();
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
                <div class="habit-matrix-grid" style="grid-template-columns: 160px repeat(${dates.length}, 36px); min-width:${160 + dates.length * 36}px;">
                    <div class="habit-matrix-cell name">习惯</div>
                    ${dates.map(date => `<div class="habit-matrix-cell head" title="${date}">${parseLocalDate(date).getDate()}</div>`).join('')}
                    ${data.habits.map(habit => `
                        <div class="habit-matrix-cell name">${escapeHtml(habit.name)}</div>
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
                <div class="habit-tab tag-${h.tag} ${currentHabitId === h.id ? 'active' : ''}" 
                    onclick="currentHabitId='${h.id}'; renderHeatmap(); renderHabitTabs(); if(currentHabitView === 'matrix') renderHabitMatrix();">
                    ${h.name}
                </div>
            `).join('');
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

        function appendHabitCheckin(habit, date, note = '') {
            if (!habit) return false;
            if (date > getTodayStr()) {
                alert('不能补未来日期的习惯打卡');
                return false;
            }
            if (habit.timesPerDay === '1' && getCheckinCount(habit.id, date) > 0) return false;
            const now = new Date();
            data.checkins.push(createHabitCheckin(habit.id, date, now, note));
            touchHabit(habit, now);
            saveData();
            return true;
        }

        function refreshHabitCheckinViews() {
            renderDashboard();
            renderAllRecords();
            renderHabitMatrix();
            if (currentHabitId) renderHeatmap();
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
                    data.checkins = data.checkins.filter(c => !(c.habitId === habitId && c.date === date));
                } else {
                    data.checkins.push(createHabitCheckin(habitId, date, now));
                }
            } else {
                // 每天多次：左键+1
                data.checkins.push(createHabitCheckin(habitId, date, now));
            }

            touchHabit(habit, now);
            saveData();
            if (currentHabitView === 'matrix') renderHabitMatrix();
            renderAllRecords();
        }

        // 右键减次数
        function decreaseCheckin(habitId, date) {
            if (date > getTodayStr()) return;
            const existing = getHabitCheckinsOnDate(habitId, date).pop();
            if (!existing) return;
            
            if (!confirm(`确认要减少【${data.habits.find(h=>h.id===habitId).name}】${date} 的打卡次数吗？`)) return;

            const habit = data.habits.find(h => h.id === habitId);
            data.checkins = data.checkins.filter(c => c.id !== existing.id);
            touchHabit(habit);
            
            saveData();
            if (currentHabitView === 'matrix') renderHabitMatrix();
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
                const count = getCheckinCount(currentHabitId, dateStr);
                
                let level = 0;
                if (count >= 1) level = 1;
                if (count >= 2) level = 2;
                if (count >= 4) level = 3;
                if (count >= 7) level = 4;

                const isCurrentYear = d.getFullYear() === year;
                const isFuture = dateStr > getTodayStr();
                cells.push(`
                    <div class="heatmap-cell ${isCurrentYear ? 'level-' + level : ''} ${isFuture ? 'future' : ''}" 
                        data-date="${dateStr}"
                        data-count="${count}"
                        ${isFuture ? '' : `onclick="toggleCheckin('${currentHabitId}', '${dateStr}'); renderHeatmap(); renderTimeline(); renderHabitMatrix();"`}
                        ${isFuture ? '' : `oncontextmenu="event.preventDefault(); decreaseCheckin('${currentHabitId}', '${dateStr}'); renderHeatmap(); renderTimeline(); renderHabitMatrix();"`}>
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

            if (habit.weekdays) {
                document.querySelectorAll('#rule-weekdays input').forEach(i => {
                    i.checked = habit.weekdays.includes(i.value);
                });
            }

            toggleHabitRule();
            document.getElementById('habit-modal').classList.add('active');
        }

        function closeHabitModal() {
            document.getElementById('habit-modal').classList.remove('active');
            editingHabitId = null;
        }

        function toggleHabitRule() {
            const rule = document.getElementById('habit-rule').value;
            document.getElementById('rule-weekdays').style.display = rule === 'weekly-fixed' ? 'block' : 'none';
            document.getElementById('rule-count').style.display = ['weekly-count','monthly-count','interval'].includes(rule) ? 'block' : 'none';
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

            const habitData = {
                name: name,
                rule: rule,
                weekdays: weekdays,
                count: count,
                timesPerDay: document.getElementById('habit-times').value,
                tag: document.getElementById('habit-tag').value,
                goalCount: parseInt(document.getElementById('habit-goal').value) || 0,
                noteMode: document.getElementById('habit-note-mode').value || 'ask'
            };

            const habitComparable = habit => JSON.stringify({
                name: habit.name || '',
                rule: habit.rule || '',
                weekdays: habit.weekdays || [],
                count: habit.count || 0,
                timesPerDay: habit.timesPerDay || '1',
                tag: habit.tag || '',
                goalCount: habit.goalCount || 0,
                noteMode: habit.noteMode || 'ask'
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
            closeHabitModal();
            renderHabitTabs();
            renderHeatmap();
            renderHabitMatrix();
            renderDashboard();
            renderTimeline();
            renderAllRecords();
        }

        function deleteCurrentHabit() {
            if (!currentHabitId) return;
            if (!confirm('确定删除这个习惯吗？所有历史打卡记录和时间轴条目都会一起删除')) return;
            
            // 清理时间轴里的打卡记录
            data.records = data.records.filter(r => !(r.isHabitRecord && r.habitId === currentHabitId));
            data.habits = data.habits.filter(h => h.id !== currentHabitId);
            data.checkins = data.checkins.filter(c => c.habitId !== currentHabitId);
            
            currentHabitId = data.habits.length > 0 ? data.habits[0].id : null;
            saveData();
            renderHabitTabs();
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
                <div class="goal-card" onclick="openGoalDetail('${g.id}')">
                    <div class="goal-info">
                        <h4>${g.name} <span style="font-size:12px; color:#97a29b; font-weight:700;">(${g.status})</span></h4>
                        <p>${g.period} · ${g.target}</p>
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
            data.goals = data.goals.filter(g => g.id !== goalId);
            saveData();
            renderGoalList();
        }

        function deleteCurrentGoal() {
            if (!currentGoalId) return;
            if (!confirm('确定删除这个目标吗？')) return;
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
                        if (confirm('导入会覆盖当前所有数据，确定继续吗？')) {
                            createLocalSnapshot('导入覆盖前');
                            data = imported;
                            saveData();
                            init();
                            alert('导入成功');
                        }
                    } catch(err) {
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
                'goal-modal': closeGoalModal,
                'template-modal': closeTemplateManage,
                'todo-detail-modal': closeTodoDetail,
                'snapshot-modal': closeSnapshotModal,
                'material-modal': closeMaterialModal
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
            if (syncConfig.autoSync && syncConfig.webdavUrl) {
                try {
                    await runCloudSync('both');
                } catch (err) {
                    updateSyncStatus(err.message || '自动同步失败', true);
                }
            }
        })();
