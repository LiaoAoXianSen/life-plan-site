(function () {
    const DEFAULT_URGENCY_META = {
        urgent: { label: '紧急', rank: 4 },
        high: { label: '高', rank: 3 },
        medium: { label: '中', rank: 2 },
        low: { label: '低', rank: 1 }
    };

    function create(options = {}) {
        const {
            urgencyMeta = DEFAULT_URGENCY_META,
            formatDate = value => value || '',
            getTodayStr = () => new Date().toISOString().slice(0, 10),
            getNowLocal = () => new Date().toISOString(),
            formatClockTime = () => '',
            genId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
        } = options;

        function getTodoUrgencyMeta(todoOrUrgency) {
            const urgency = typeof todoOrUrgency === 'string'
                ? todoOrUrgency
                : todoOrUrgency?.urgency;
            return urgencyMeta[urgency] || urgencyMeta.medium;
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

        function hasTodoSessionOnDate(todo, date) {
            return (todo?.sessions || []).some(session => session.date === date);
        }

        function toggleTodoDone(todo, now = new Date()) {
            if (!todo) return null;
            const today = getTodayStr();
            const stamp = getNowLocal(now);
            todo.sessions = Array.isArray(todo.sessions) ? todo.sessions : [];
            todo.done = !todo.done;
            todo.completedAt = todo.done ? stamp : '';
            if (todo.done && !hasTodoSessionOnDate(todo, today)) {
                todo.sessions.push({
                    id: genId(),
                    date: today,
                    startTime: formatClockTime(now),
                    endTime: '',
                    note: '勾选完成',
                    createdAt: stamp
                });
            }
            todo.updatedAt = stamp;
            return todo;
        }

        function syncDoneFromSubTodos(todo, stamp = getNowLocal()) {
            if (!todo || !Array.isArray(todo.subTodos) || !todo.subTodos.length) return todo;
            const allDone = todo.subTodos.every(sub => sub.done);
            todo.done = allDone;
            todo.completedAt = allDone ? (todo.completedAt || stamp) : '';
            return todo;
        }

        function normalizeTodoDateRange(planStartDate = '', planEndDate = '') {
            let start = planStartDate;
            let end = planEndDate;
            if (start && !end) end = start;
            if (!start && end) start = end;
            return { planStartDate: start, planEndDate: end, isValid: !(start && end && start > end) };
        }

        function normalizeTodoTextKey(value = '') {
            return String(value || '')
                .toLowerCase()
                .replace(/[（(].*?[）)]/g, '')
                .replace(/^(推进|补上|验证灵感|待办|任务)[:：\s]*/u, '')
                .replace(/^(做一下|去做|准备|需要|打算|计划|想要|想|再|先|去)/u, '')
                .replace(/[\s\u3000"'“”‘’`~!@#$%^&*+=|\\/?:;,.，。！？、·…\-_/<>\[\]{}]+/g, '')
                .trim();
        }

        function getTodoTextBigrams(key = '') {
            const text = String(key || '');
            if (!text) return [];
            if (text.length === 1) return [text];
            const grams = [];
            for (let i = 0; i < text.length - 1; i += 1) grams.push(text.slice(i, i + 2));
            return grams;
        }

        function scoreTodoTextSimilarity(a = '', b = '') {
            const left = normalizeTodoTextKey(a);
            const right = normalizeTodoTextKey(b);
            if (!left || !right) return 0;
            if (left === right) return 1;
            if (left.includes(right) || right.includes(left)) {
                const shorter = Math.min(left.length, right.length);
                const longer = Math.max(left.length, right.length);
                return Math.min(0.98, 0.72 + (shorter / longer) * 0.26);
            }
            const leftGrams = getTodoTextBigrams(left);
            const rightGrams = getTodoTextBigrams(right);
            if (!leftGrams.length || !rightGrams.length) return 0;
            const rightCount = new Map();
            rightGrams.forEach(gram => rightCount.set(gram, (rightCount.get(gram) || 0) + 1));
            let overlap = 0;
            leftGrams.forEach(gram => {
                const count = rightCount.get(gram) || 0;
                if (count > 0) {
                    overlap += 1;
                    rightCount.set(gram, count - 1);
                }
            });
            return (2 * overlap) / (leftGrams.length + rightGrams.length);
        }

        function findMatchingTodo(candidates = [], item = {}, options = {}) {
            const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
            if (!list.length) return null;
            const text = String(item?.text || '').trim();
            const matchKey = normalizeTodoTextKey(item?.sourceMatchKey || item?.matchKey || text);
            if (!text && !matchKey) return null;
            const threshold = Number(options.threshold);
            const minScore = Number.isFinite(threshold) ? threshold : 0.72;
            const preferSourceId = String(options.sourceRecordId || item?.sourceRecordId || '').trim();
            let best = null;

            list.forEach(todo => {
                let score = 0;
                let reason = '';
                const todoKey = normalizeTodoTextKey(todo.sourceMatchKey || todo.text || '');
                if (preferSourceId && todo.sourceRecordId === preferSourceId && matchKey && todoKey === matchKey) {
                    score = 1;
                    reason = 'same-source-key';
                } else if (matchKey && todoKey === matchKey) {
                    score = 0.99;
                    reason = 'exact-key';
                } else {
                    score = scoreTodoTextSimilarity(text || matchKey, todo.text || '');
                    if (todo.sourceMatchKey) {
                        score = Math.max(score, scoreTodoTextSimilarity(text || matchKey, todo.sourceMatchKey));
                    }
                    reason = score >= 0.9 ? 'near-text' : 'similar-text';
                }

                // Soft boost when plan windows overlap or share the same day.
                const itemStart = item.planStartDate || item.dueDate || '';
                const todoStart = todo.planStartDate || todo.dueDate || '';
                if (itemStart && todoStart && itemStart === todoStart && score >= 0.55) {
                    score = Math.min(1, score + 0.08);
                }

                if (preferSourceId && todo.sourceRecordId === preferSourceId && score >= 0.55) {
                    score = Math.min(1, score + 0.06);
                }
                if (Array.isArray(options.linkedTodoIds) && options.linkedTodoIds.includes(todo.id) && score >= 0.55) {
                    score = Math.min(1, score + 0.05);
                }

                if (score < minScore) return;
                if (!best || score > best.score) {
                    best = { todo, score, reason };
                }
            });
            return best;
        }

        function createTodoFromAiItem(item, overrides = {}) {
            const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
            const pickDate = (key, fallback = '') => {
                if (has(overrides, key)) return String(overrides[key] || '').trim();
                if (has(item, key)) return String(item[key] || '').trim();
                return fallback;
            };
            const pickText = (key, fallback = '') => {
                if (has(overrides, key)) return String(overrides[key] || '').trim();
                if (has(item, key)) return String(item[key] || '').trim();
                return fallback;
            };
            let planStartDate = pickDate('planStartDate');
            let planEndDate = pickDate('planEndDate');
            let dueDate = pickDate('dueDate');
            if (planStartDate && !planEndDate) planEndDate = planStartDate;
            if (!planStartDate && planEndDate) planStartDate = planEndDate;
            if (!dueDate && planEndDate) dueDate = planEndDate;
            // Keep empty dates empty so fuzzy weekend plans are not forced onto today.
            const text = pickText('text', item.text || '');
            const sourceMatchKey = normalizeTodoTextKey(
                pickText('sourceMatchKey', item.sourceMatchKey || item.matchKey || text)
            );
            const stamp = getNowLocal();
            return {
                id: genId(),
                text,
                note: item.note || item.reason || '',
                done: false,
                dueDate,
                planStartDate,
                planEndDate,
                urgency: urgencyMeta[item.urgency] ? item.urgency : 'medium',
                group: item.group || '其他',
                subTodos: (item.subTodos || []).map(sub => ({ text: sub.text, done: false })),
                sessions: [],
                isExclusive: false,
                createdAt: stamp,
                updatedAt: stamp,
                completedAt: '',
                sourceType: pickText('sourceType', item.sourceType || 'ai') || 'ai',
                sourceRecordId: pickText('sourceRecordId', item.sourceRecordId || ''),
                sourceMatchKey
            };
        }

        return {
            urgencyMeta,
            getTodoUrgencyMeta,
            getTodoSortDate,
            compareTodosForFocus,
            formatTodoDueDate,
            getTodoPlanLabel,
            isTodoInDateRange,
            hasTodoSessionOnDate,
            toggleTodoDone,
            syncDoneFromSubTodos,
            normalizeTodoDateRange,
            normalizeTodoTextKey,
            scoreTodoTextSimilarity,
            findMatchingTodo,
            createTodoFromAiItem
        };
    }

    window.LifePlanTodosService = { create, DEFAULT_URGENCY_META };
})();
