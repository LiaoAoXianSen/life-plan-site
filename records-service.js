(function () {
    function create(options = {}) {
        const {
            ideaStatusOptions = [],
            ideaUnprocessedStatuses = new Set(),
            normalizeTagList = tags => Array.isArray(tags) ? tags : [],
            formatDate = value => value || '',
            formatLocalDateKey = date => date.toISOString().slice(0, 10)
        } = options;

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
