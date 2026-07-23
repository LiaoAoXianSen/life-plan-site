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

        function asArray(value) {
            return Array.isArray(value) ? value : [];
        }

        function normalizeId(value) {
            if (value === undefined || value === null) return '';
            return String(value).trim();
        }

        function isTodoDeletionItem(item = {}) {
            return normalizeId(item?.collection || item?.type || item?.entity || item?.entityType || item?.kind) === 'todos';
        }

        function getTodoLegacySourceSlice(source = {}) {
            return {
                todos: asArray(source.todos),
                deletedItems: asArray(source.deletedItems).filter(isTodoDeletionItem)
            };
        }

        function normalizeTodoSession(session = {}, index = 0) {
            if (!session || typeof session !== 'object') return null;
            const next = {
                ...session,
                id: normalizeId(session.id) || `session-${index + 1}`,
                date: typeof session.date === 'string' ? session.date : '',
                startTime: typeof session.startTime === 'string' ? session.startTime : '',
                endTime: typeof session.endTime === 'string' ? session.endTime : '',
                note: typeof session.note === 'string' ? session.note : '',
                createdAt: typeof session.createdAt === 'string' ? session.createdAt : ''
            };
            return next;
        }

        function normalizeTodoSubTodo(sub = {}) {
            if (!sub || typeof sub !== 'object') return null;
            return {
                ...sub,
                text: typeof sub.text === 'string' ? sub.text : String(sub.text || ''),
                done: !!sub.done
            };
        }

        function normalizeTodoEntity(todo = {}, index = 0) {
            if (!todo || typeof todo !== 'object') return null;
            const text = typeof todo.text === 'string' ? todo.text : String(todo.text || '');
            const sourceMatchKey = typeof todo.sourceMatchKey === 'string' && todo.sourceMatchKey
                ? todo.sourceMatchKey
                : normalizeTodoTextKey(text);
            const urgency = urgencyMeta[todo.urgency] ? todo.urgency : 'medium';
            return {
                ...todo,
                id: normalizeId(todo.id) || `todo-${index + 1}`,
                text,
                note: typeof todo.note === 'string' ? todo.note : '',
                done: !!todo.done,
                dueDate: typeof todo.dueDate === 'string' ? todo.dueDate : '',
                planStartDate: typeof todo.planStartDate === 'string' ? todo.planStartDate : '',
                planEndDate: typeof todo.planEndDate === 'string' ? todo.planEndDate : '',
                urgency,
                group: typeof todo.group === 'string' && todo.group ? todo.group : '其他',
                subTodos: asArray(todo.subTodos).map(normalizeTodoSubTodo).filter(Boolean),
                sessions: asArray(todo.sessions).map(normalizeTodoSession).filter(Boolean),
                isExclusive: !!todo.isExclusive,
                createdAt: typeof todo.createdAt === 'string' ? todo.createdAt : '',
                updatedAt: typeof todo.updatedAt === 'string' ? todo.updatedAt : '',
                completedAt: typeof todo.completedAt === 'string' ? todo.completedAt : '',
                sourceType: typeof todo.sourceType === 'string' ? todo.sourceType : '',
                sourceRecordId: typeof todo.sourceRecordId === 'string' ? todo.sourceRecordId : '',
                sourceMatchKey
            };
        }

        function normalizeTodoDeletedItem(item = {}, index = 0) {
            if (!item || typeof item !== 'object' || !isTodoDeletionItem(item)) return null;
            const id = normalizeId(item.id || item.targetId || item.itemId || item.entityId);
            if (!id) return null;
            return {
                ...item,
                collection: 'todos',
                id,
                deletedAt: typeof item.deletedAt === 'string' && item.deletedAt
                    ? item.deletedAt
                    : getNowLocal(),
                reason: typeof item.reason === 'string' ? item.reason : '',
                text: typeof item.text === 'string' ? item.text : '',
                recordId: typeof item.recordId === 'string' ? item.recordId : '',
                sourceIndex: index
            };
        }

        function getTodoSnapshotCollectionSummary(snapshot = {}) {
            return {
                todos: asArray(snapshot.todos).length,
                deletedItems: asArray(snapshot.deletedItems).length,
                openTodos: asArray(snapshot.todos).filter(item => !item?.done).length,
                doneTodos: asArray(snapshot.todos).filter(item => !!item?.done).length,
                exclusiveTodos: asArray(snapshot.todos).filter(item => !!item?.isExclusive).length,
                withSourceRecord: asArray(snapshot.todos).filter(item => !!normalizeId(item?.sourceRecordId)).length
            };
        }

        function getTodoAppCanonicalSnapshot(source = {}) {
            const input = source && typeof source === 'object' ? source : {};
            const todos = asArray(input.todos).map((item, index) => normalizeTodoEntity(item, index)).filter(Boolean);
            const deletedItems = asArray(input.deletedItems)
                .map((item, index) => normalizeTodoDeletedItem(item, index))
                .filter(Boolean);
            return {
                schemaVersion: Number.isFinite(Number(input.schemaVersion)) ? Number(input.schemaVersion) : 1,
                generatedAt: typeof input.generatedAt === 'string' && input.generatedAt
                    ? input.generatedAt
                    : new Date().toISOString(),
                todos,
                deletedItems
            };
        }

        function getTodoAppHashPayload(source = {}) {
            const snapshot = getTodoAppCanonicalSnapshot(source);
            return {
                schemaVersion: snapshot.schemaVersion,
                todos: snapshot.todos,
                deletedItems: snapshot.deletedItems
            };
        }

        function buildTodoAppSnapshot(source = {}, options = {}) {
            const slice = getTodoLegacySourceSlice(source);
            const mode = options.mode === 'local-mirror' ? 'local-mirror' : 'preview';
            const generatedAt = options.generatedAt || new Date().toISOString();
            const sourceHash = normalizeId(options.sourceHash);
            const todos = slice.todos.map((item, index) => normalizeTodoEntity(item, index)).filter(Boolean);
            const deletedItems = slice.deletedItems
                .map((item, index) => normalizeTodoDeletedItem(item, index))
                .filter(Boolean);
            const snapshot = {
                schemaVersion: 1,
                generatedAt,
                authority: 'lifePlanData.todos',
                remotePath: '/apps/todo-app/data.json',
                remoteUploadEnabled: false,
                todos,
                deletedItems
            };

            if (mode === 'preview') {
                snapshot.readOnlyPreview = true;
            } else {
                snapshot.localMirror = true;
                snapshot.mirror = {
                    mode: 'local-only',
                    reason: options.reason || 'manual-rebuild',
                    rebuiltAt: generatedAt,
                    sourceHash: sourceHash || undefined,
                    dualWriteEnabledPaths: asArray(options.dualWriteEnabledPaths)
                };
            }

            return snapshot;
        }

        function buildTodoAppSnapshotPreview(source = {}, options = {}) {
            const snapshot = buildTodoAppSnapshot(source, { ...options, mode: 'preview' });
            return {
                generatedAt: snapshot.generatedAt,
                readOnly: true,
                summary: getTodoSnapshotCollectionSummary(snapshot),
                snapshot,
                jsonText: JSON.stringify(snapshot, null, 2)
            };
        }

        function buildTodoAppLocalMirror(source = {}, options = {}) {
            const snapshot = buildTodoAppSnapshot(source, { ...options, mode: 'local-mirror' });
            return {
                generatedAt: snapshot.generatedAt,
                readOnly: false,
                remoteUploadEnabled: false,
                summary: getTodoSnapshotCollectionSummary(snapshot),
                snapshot,
                jsonText: JSON.stringify(snapshot, null, 2)
            };
        }

        function summarizeTodoAppLocalMirror(mirror = null, expectedSourceHash = '') {
            const snapshot = mirror && typeof mirror === 'object' ? mirror : null;
            const summary = snapshot ? getTodoSnapshotCollectionSummary(snapshot) : {};
            const storedSourceHash = normalizeId(snapshot?.mirror?.sourceHash || snapshot?.sourceHash);
            const expected = normalizeId(expectedSourceHash);
            return {
                exists: !!snapshot,
                generatedAt: snapshot?.generatedAt || '',
                rebuiltAt: snapshot?.mirror?.rebuiltAt || snapshot?.generatedAt || '',
                reason: snapshot?.mirror?.reason || '',
                sourceHash: storedSourceHash,
                sourceHashShort: storedSourceHash ? storedSourceHash.slice(0, 12) : '',
                matchesSource: !!(expected && storedSourceHash && expected === storedSourceHash),
                remoteUploadEnabled: snapshot?.remoteUploadEnabled === true,
                localMirror: snapshot?.localMirror === true,
                schemaVersion: Number(snapshot?.schemaVersion) || 0,
                summary
            };
        }

        function buildTodoDualWriteConsistency(source = {}, mirror = null, expectedSourceHash = '') {
            const slice = getTodoLegacySourceSlice(source);
            const mirrorSummary = summarizeTodoAppLocalMirror(mirror, expectedSourceHash);
            const comparisons = [
                {
                    id: 'todos',
                    label: '待办',
                    legacy: slice.todos.length,
                    mirror: mirrorSummary.summary.todos || 0
                },
                {
                    id: 'openTodos',
                    label: '未完成',
                    legacy: slice.todos.filter(item => !item?.done).length,
                    mirror: mirrorSummary.summary.openTodos || 0
                },
                {
                    id: 'doneTodos',
                    label: '已完成',
                    legacy: slice.todos.filter(item => !!item?.done).length,
                    mirror: mirrorSummary.summary.doneTodos || 0
                },
                {
                    id: 'deletedItems',
                    label: '删除标记',
                    legacy: slice.deletedItems.length,
                    mirror: mirrorSummary.summary.deletedItems || 0
                }
            ].map(item => ({
                ...item,
                matched: item.legacy === item.mirror,
                delta: item.mirror - item.legacy
            }));

            const legacyIds = new Set(slice.todos.map(item => normalizeId(item?.id)).filter(Boolean));
            const mirrorIds = new Set(asArray(mirror?.todos).map(item => normalizeId(item?.id)).filter(Boolean));
            const missingInMirror = Array.from(legacyIds).filter(id => !mirrorIds.has(id));
            const extraInMirror = Array.from(mirrorIds).filter(id => !legacyIds.has(id));
            const mismatches = comparisons.filter(item => !item.matched).map(item => `${item.label}不一致`);
            if (mirrorSummary.exists && !mirrorSummary.matchesSource) {
                mismatches.unshift('sourceHash 未对齐旧数据');
            }
            if (!mirrorSummary.exists) {
                mismatches.unshift('本地镜像不存在');
            }
            if (missingInMirror.length) {
                mismatches.push(`镜像缺少 ${missingInMirror.length} 个 todo id`);
            }
            if (extraInMirror.length) {
                mismatches.push(`镜像多出 ${extraInMirror.length} 个 todo id`);
            }

            let status = 'matched';
            let statusLabel = '本地镜像已对齐旧数据';
            if (!mirrorSummary.exists) {
                status = 'missing';
                statusLabel = '本地镜像尚未建立';
            } else if (mismatches.length) {
                status = 'mismatch';
                statusLabel = '本地镜像与旧数据不一致';
            }

            return {
                generatedAt: new Date().toISOString(),
                status,
                statusLabel,
                authority: 'lifePlanData.todos',
                remoteUploadEnabled: false,
                mirror: mirrorSummary,
                comparisons,
                missingInMirror: missingInMirror.slice(0, 12),
                extraInMirror: extraInMirror.slice(0, 12),
                mismatches,
                summary: {
                    comparisonTotal: comparisons.length,
                    comparisonMatched: comparisons.filter(item => item.matched).length,
                    mismatchCount: mismatches.length
                }
            };
        }

        function getTodoEntityTime(item) {
            if (!item || typeof item !== 'object') return 0;
            const raw = item.updatedAt || item.completedAt || item.createdAt || item.dueDate || '';
            const time = new Date(raw).getTime();
            return Number.isFinite(time) ? time : 0;
        }

        function buildTodoDeletionMap(local = {}, remote = {}) {
            const map = new Map();
            [...asArray(local.deletedItems), ...asArray(remote.deletedItems)].forEach((item, index) => {
                const normalized = normalizeTodoDeletedItem(item, index);
                if (!normalized) return;
                const key = normalized.id;
                const current = map.get(key);
                if (!current || new Date(normalized.deletedAt || 0).getTime() >= new Date(current.deletedAt || 0).getTime()) {
                    map.set(key, normalized);
                }
            });
            return map;
        }

        function shouldKeepMergedTodo(item, deletionMap) {
            const id = normalizeId(item?.id);
            if (!id) return true;
            const tombstone = deletionMap.get(id);
            if (!tombstone) return true;
            return getTodoEntityTime(item) > new Date(tombstone.deletedAt || 0).getTime();
        }

        function mergeTodoEntities(localItems = [], remoteItems = [], deletionMap = new Map()) {
            const merged = new Map();
            [...asArray(localItems), ...asArray(remoteItems)].forEach((item, index) => {
                const normalized = normalizeTodoEntity(item, index);
                if (!normalized) return;
                const id = normalized.id;
                const current = merged.get(id);
                if (!current || getTodoEntityTime(normalized) >= getTodoEntityTime(current)) {
                    merged.set(id, normalized);
                }
            });
            return Array.from(merged.values()).filter(item => shouldKeepMergedTodo(item, deletionMap));
        }

        function mergeTodoSnapshots(localSnapshot, remoteSnapshot) {
            const local = getTodoAppCanonicalSnapshot(localSnapshot || {});
            const remote = getTodoAppCanonicalSnapshot(remoteSnapshot || {});
            const deletionMap = buildTodoDeletionMap(local, remote);
            const todos = mergeTodoEntities(local.todos, remote.todos, deletionMap);
            const deletedItems = Array.from(deletionMap.values());
            return {
                schemaVersion: Math.max(local.schemaVersion || 1, remote.schemaVersion || 1),
                generatedAt: new Date().toISOString(),
                todos,
                deletedItems
            };
        }

        function getTodoDualWritePathInventory() {
            return [
                {
                    id: 'save-data-central',
                    label: '主数据保存（统一双写）',
                    fn: 'saveData',
                    legacyTargets: ['todos', 'deletedItems'],
                    snapshotTargets: ['todos', 'deletedItems'],
                    priority: 1,
                    dualWrite: 'enabled',
                    note: '所有待办变更最终都会走 saveData；sourceHash 变化时重建 localStorage.todoAppData，不上传云端。'
                },
                {
                    id: 'toggle-todo',
                    label: '勾选完成 / 恢复',
                    fn: 'toggleTodo',
                    legacyTargets: ['todos'],
                    snapshotTargets: ['todos'],
                    priority: 1,
                    dualWrite: 'enabled',
                    note: '通过 saveData 触发镜像重建。'
                },
                {
                    id: 'save-todo-detail',
                    label: '新建 / 编辑待办',
                    fn: 'saveTodoDetail',
                    legacyTargets: ['todos'],
                    snapshotTargets: ['todos'],
                    priority: 1,
                    dualWrite: 'enabled',
                    note: '含子任务、计划日期与执行记录；通过 saveData 触发。'
                },
                {
                    id: 'delete-todo',
                    label: '删除待办',
                    fn: 'deleteCurrentTodo',
                    legacyTargets: ['todos', 'deletedItems', 'records'],
                    snapshotTargets: ['todos', 'deletedItems'],
                    priority: 1,
                    dualWrite: 'enabled',
                    note: '写 tombstone 并重建镜像；records 引用仍由 lifePlanData 持有。'
                },
                {
                    id: 'record-todo-link',
                    label: '记录关联待办增删',
                    fn: 'saveRecord',
                    legacyTargets: ['todos', 'deletedItems', 'records'],
                    snapshotTargets: ['todos', 'deletedItems'],
                    priority: 2,
                    dualWrite: 'enabled',
                    note: '记录保存可能增删专属待办；镜像只同步 todos/tombstone。'
                },
                {
                    id: 'ai-and-import',
                    label: 'AI 生成 / 导入合并',
                    fn: 'createTodoFromAiItem / importData',
                    legacyTargets: ['todos', 'deletedItems'],
                    snapshotTargets: ['todos', 'deletedItems'],
                    priority: 2,
                    dualWrite: 'enabled',
                    note: '导入与 AI 批量写入后由 saveData 统一双写。'
                }
            ];
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
            createTodoFromAiItem,
            getTodoLegacySourceSlice,
            normalizeTodoEntity,
            getTodoAppCanonicalSnapshot,
            getTodoAppHashPayload,
            buildTodoAppSnapshot,
            buildTodoAppSnapshotPreview,
            buildTodoAppLocalMirror,
            summarizeTodoAppLocalMirror,
            buildTodoDualWriteConsistency,
            getTodoDualWritePathInventory,
            getTodoSnapshotCollectionSummary,
            mergeTodoSnapshots
        };
    }

    window.LifePlanTodosService = { create, DEFAULT_URGENCY_META };
})();
