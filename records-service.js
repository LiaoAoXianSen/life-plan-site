(function () {
    function create(options = {}) {
        const {
            ideaStatusOptions = [],
            ideaUnprocessedStatuses = new Set(),
            normalizeTagList = tags => Array.isArray(tags) ? tags : [],
            formatDate = value => value || '',
            formatLocalDateKey = date => date.toISOString().slice(0, 10)
        } = options;

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

        function getBuiltInTemplates(type = '') {
            return builtInTemplates.filter(template => !type || template.type === type);
        }

        function getBuiltInTemplate(id) {
            return builtInTemplates.find(template => template.id === id);
        }

        function composeTemplateContent(template, values = {}) {
            if (!template?.fields) return template?.content || '';
            return template.fields.map(field => {
                const text = String(values[field.id] || '').trim();
                return `# ${field.label}\n${text}`;
            }).join('\n\n') + '\n';
        }

        function parseTemplateContent(template, content = '') {
            if (!template?.fields) return {};
            const sections = new Map(parseRecordContentSections(content).map(section => [
                String(section.title || '').trim(),
                section.body.join('\n').trim()
            ]));
            return Object.fromEntries(template.fields.map(field => [field.id, sections.get(field.label) || '']));
        }

        function getIdeaStatus(record) {
            return ideaStatusOptions.includes(record?.ideaStatus) ? record.ideaStatus : '待整理';
        }

        function getIdeaTags(record) {
            return normalizeTagList(record?.ideaTags);
        }

        function isIdeaUnprocessed(record) {
            return ideaUnprocessedStatuses.has(getIdeaStatus(record));
        }

        function ideaNeedsConclusion(record) {
            return ['实践中', '已验证'].includes(getIdeaStatus(record)) && !String(record?.ideaConclusion || '').trim();
        }

        function getIdeaTodoText(record) {
            return (record?.ideaNextAction || record?.title || '实践一条灵感')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 60) || '实践一条灵感';
        }

        function getIdeaTodoNote(record) {
            return [
                record?.title ? `来源灵感：${record.title}` : '来源灵感',
                record?.content ? `内容：${record.content}` : '',
                record?.ideaConclusion ? `结论：${record.ideaConclusion}` : ''
            ].filter(Boolean).join('\n\n');
        }

        function getRecordDateRangeLabel(record) {
            const start = record?.startDate ? formatDate(record.startDate) : '';
            const end = record?.endDate ? formatDate(record.endDate) : '';
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

        function getSuggestedRangeForType(type, baseDate = new Date()) {
            const today = new Date(baseDate);
            const todayStr = formatLocalDateKey(today);

            switch (type) {
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
                    return { start: formatLocalDateKey(monday), end: formatLocalDateKey(sunday) };
                }
                case '月复盘':
                case '月计划': {
                    const start = new Date(today.getFullYear(), today.getMonth(), 1);
                    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    return { start: formatLocalDateKey(start), end: formatLocalDateKey(end) };
                }
                case '年复盘':
                case '年度计划': {
                    const year = today.getFullYear();
                    return { start: `${year}-01-01`, end: `${year}-12-31` };
                }
                case '3年计划': {
                    const year = today.getFullYear();
                    return { start: `${year}-01-01`, end: `${year + 2}-12-31` };
                }
                case '终身愿景':
                    return { start: todayStr, end: '' };
                default:
                    return { start: todayStr, end: todayStr };
            }
        }

        function filterIdeas(records = [], options = {}) {
            const {
                keyword = '',
                statusFilter = 'all',
                tagFilter = '',
                hasMatchingTag = () => true,
                getRecordSortValue = record => record?.updatedAt || record?.startDate || ''
            } = options;
            const cleanKeyword = String(keyword || '').trim().toLowerCase();
            return records
                .filter(record => record.type === '灵感碎片')
                .filter(record => {
                    if (statusFilter === 'unprocessed') return isIdeaUnprocessed(record);
                    if (statusFilter === 'needsConclusion') return ideaNeedsConclusion(record);
                    if (statusFilter !== 'all') return getIdeaStatus(record) === statusFilter;
                    return true;
                })
                .filter(record => hasMatchingTag(getIdeaTags(record), tagFilter))
                .filter(record => {
                    if (!cleanKeyword) return true;
                    return [record.title, record.content, record.ideaNextAction, record.ideaConclusion, getIdeaStatus(record), ...getIdeaTags(record)]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase()
                        .includes(cleanKeyword);
                })
                .sort((a, b) => {
                    if (statusFilter === 'all') {
                        const aVerified = getIdeaStatus(a) === '已验证' ? 1 : 0;
                        const bVerified = getIdeaStatus(b) === '已验证' ? 1 : 0;
                        if (aVerified !== bVerified) return aVerified - bVerified;
                    }
                    return getRecordSortValue(b).localeCompare(getRecordSortValue(a));
                });
        }

        return {
            getBuiltInTemplates,
            getBuiltInTemplate,
            composeTemplateContent,
            parseTemplateContent,
            getIdeaStatus,
            getIdeaTags,
            isIdeaUnprocessed,
            ideaNeedsConclusion,
            getIdeaTodoText,
            getIdeaTodoNote,
            getRecordDateRangeLabel,
            parseRecordContentSections,
            getSuggestedRangeForType,
            filterIdeas
        };
    }

    window.LifePlanRecordsService = { create };
})();
