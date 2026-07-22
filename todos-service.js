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

        function createTodoFromAiItem(item, overrides = {}) {
            const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
            const pickDate = (key, fallback = '') => {
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
            const stamp = getNowLocal();
            return {
                id: genId(),
                text: item.text,
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
                sourceType: 'ai'
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
            createTodoFromAiItem
        };
    }

    window.LifePlanTodosService = { create, DEFAULT_URGENCY_META };
})();
