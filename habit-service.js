(function () {
    'use strict';

    const DEFAULT_CURRENCY = '金币';
    const DEFAULT_DETAIL_LIMIT = 8;

    function asArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function normalizeId(value) {
        if (value === undefined || value === null) return '';
        return String(value).trim();
    }

    function normalizeCurrency(value, fallback) {
        const text = value === undefined || value === null ? '' : String(value).trim();
        return text || fallback || DEFAULT_CURRENCY;
    }

    function parseAmount(value) {
        if (value === undefined || value === null || value === '') {
            return { value: 0, valid: false };
        }
        const number = Number(value);
        return { value: number, valid: Number.isFinite(number) };
    }

    function fallbackTodayStr() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function fallbackAddDays(dateStr, amount) {
        const [year, month, day] = String(dateStr || fallbackTodayStr()).split('-').map(Number);
        const date = new Date(year || 1970, (month || 1) - 1, day || 1);
        date.setDate(date.getDate() + amount);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function fallbackIsDue(habit) {
        return !habit || habit.archived !== true;
    }

    function fallbackTargetCount(habit) {
        const count = parseInt(habit?.timesPerDay ?? habit?.targetCount ?? '1', 10);
        return Math.max(1, Number.isFinite(count) ? count : 1);
    }

    function getDuplicateValues(items, fieldName) {
        const seen = new Map();
        const duplicates = new Map();
        asArray(items).forEach(item => {
            const value = normalizeId(item?.[fieldName]);
            if (!value) return;
            const count = seen.get(value) || 0;
            seen.set(value, count + 1);
            if (count >= 1) duplicates.set(value, count + 1);
        });
        return Array.from(duplicates.entries()).map(([value, count]) => ({ value, count }));
    }

    function getMissingIdItems(items) {
        return asArray(items)
            .map((item, index) => ({ index, item }))
            .filter(entry => !normalizeId(entry.item?.id));
    }

    function capDetails(details, limit = DEFAULT_DETAIL_LIMIT) {
        return details.slice(0, limit).map(detail => ({ ...detail }));
    }

    function makeIssue(type, severity, label, details, hint) {
        return {
            type,
            severity,
            label,
            count: details.length,
            details: capDetails(details),
            hiddenCount: Math.max(0, details.length - DEFAULT_DETAIL_LIMIT),
            hint: hint || ''
        };
    }

    function getDeletedKind(item) {
        return normalizeId(item?.collection || item?.type || item?.entity || item?.entityType || item?.kind);
    }

    function create(options = {}) {
        const defaultCurrency = options.defaultCurrency || DEFAULT_CURRENCY;
        const getTodayStr = typeof options.getTodayStr === 'function' ? options.getTodayStr : fallbackTodayStr;
        const addDays = typeof options.addDays === 'function' ? options.addDays : fallbackAddDays;
        const isHabitDueOnDate = typeof options.isHabitDueOnDate === 'function' ? options.isHabitDueOnDate : fallbackIsDue;
        const getHabitTargetCount = typeof options.getHabitTargetCount === 'function' ? options.getHabitTargetCount : fallbackTargetCount;

        function getWalletBalances(ledger) {
            const balances = new Map();
            asArray(ledger).forEach(entry => {
                const amount = parseAmount(entry?.amount);
                if (!amount.valid) return;
                const currency = normalizeCurrency(entry?.currency, defaultCurrency);
                balances.set(currency, (balances.get(currency) || 0) + amount.value);
            });
            return Array.from(balances.entries())
                .sort(([a], [b]) => a.localeCompare(b, 'zh-Hans-CN'))
                .map(([currency, amount]) => ({ currency, amount }));
        }

        function buildLegacyHabitDiagnostics(source = {}) {
            const habits = asArray(source.habits);
            const checkins = asArray(source.checkins);
            const ledger = asArray(source.habitPointLedger);
            const rewards = asArray(source.habitRewards);
            const currencies = asArray(source.habitCurrencies);
            const deletedItems = asArray(source.deletedItems);
            const today = getTodayStr();
            const lastSevenDates = new Set(Array.from({ length: 7 }, (_, index) => addDays(today, -index)));
            const habitIds = new Set(habits.map(item => normalizeId(item?.id)).filter(Boolean));
            const rewardIds = new Set(rewards.map(item => normalizeId(item?.id)).filter(Boolean));
            const issues = [];

            const duplicateHabitIds = getDuplicateValues(habits, 'id');
            if (duplicateHabitIds.length) {
                issues.push(makeIssue(
                    'duplicate-habit-id',
                    'danger',
                    '重复习惯 ID',
                    duplicateHabitIds.map(item => ({ id: item.value, count: item.count })),
                    '同一个旧习惯 ID 出现多次，后续生成 habit-app 映射前必须先人工处理。'
                ));
            }

            const missingHabitIds = getMissingIdItems(habits);
            if (missingHabitIds.length) {
                issues.push(makeIssue(
                    'missing-habit-id',
                    'danger',
                    '习惯缺少 ID',
                    missingHabitIds.map(item => ({ row: item.index + 1, name: item.item?.name || '' })),
                    '缺少 ID 的习惯无法稳定映射到云端实体。'
                ));
            }

            const duplicateCheckinIds = getDuplicateValues(checkins, 'id');
            if (duplicateCheckinIds.length) {
                issues.push(makeIssue(
                    'duplicate-checkin-id',
                    'danger',
                    '重复打卡 ID',
                    duplicateCheckinIds.map(item => ({ id: item.value, count: item.count })),
                    '同一个旧打卡 ID 出现多次，合并时可能覆盖或重复入账。'
                ));
            }

            const missingCheckinIds = getMissingIdItems(checkins);
            if (missingCheckinIds.length) {
                issues.push(makeIssue(
                    'missing-checkin-id',
                    'warning',
                    '打卡记录缺少 ID',
                    missingCheckinIds.map(item => ({ row: item.index + 1, habitId: item.item?.habitId || '', date: item.item?.date || '' })),
                    '缺少 ID 的历史记录后续只能按内容生成临时来源键。'
                ));
            }

            const orphanCheckins = checkins.filter(item => {
                const habitId = normalizeId(item?.habitId);
                return habitId && !habitIds.has(habitId);
            });
            if (orphanCheckins.length) {
                issues.push(makeIssue(
                    'orphan-checkins',
                    'danger',
                    '孤儿打卡记录',
                    orphanCheckins.map(item => ({ id: item.id || '', habitId: item.habitId || '', date: item.date || '' })),
                    '这些 checkins 指向已不存在的 habitId，导入 habit-app 前需要决定归属或保留为 tombstone。'
                ));
            }

            const orphanLedgerHabits = ledger.filter(item => {
                const habitId = normalizeId(item?.habitId);
                return habitId && !habitIds.has(habitId);
            });
            if (orphanLedgerHabits.length) {
                issues.push(makeIssue(
                    'orphan-ledger-habits',
                    'warning',
                    '流水指向缺失习惯',
                    orphanLedgerHabits.map(item => ({ id: item.id || '', habitId: item.habitId || '', amount: item.amount ?? '', currency: item.currency || '' })),
                    '这些旧钱包流水仍可保留，但 PC/Android 展示名称会缺失。'
                ));
            }

            const orphanLedgerRewards = ledger.filter(item => {
                const rewardId = normalizeId(item?.rewardId);
                return rewardId && !rewardIds.has(rewardId);
            });
            if (orphanLedgerRewards.length) {
                issues.push(makeIssue(
                    'orphan-ledger-rewards',
                    'warning',
                    '流水指向缺失心愿',
                    orphanLedgerRewards.map(item => ({ id: item.id || '', rewardId: item.rewardId || '', amount: item.amount ?? '', currency: item.currency || '' })),
                    '兑换流水缺少心愿实体时，后续只能展示流水本身。'
                ));
            }

            const invalidLedgerAmounts = ledger.filter(item => !parseAmount(item?.amount).valid);
            if (invalidLedgerAmounts.length) {
                issues.push(makeIssue(
                    'invalid-ledger-amount',
                    'danger',
                    '流水金额异常',
                    invalidLedgerAmounts.map(item => ({ id: item.id || '', amount: item.amount ?? '', currency: item.currency || '' })),
                    '金额不能转成数字会影响钱包余额和同步合并。'
                ));
            }

            const emptyLedgerCurrencies = ledger.filter(item => normalizeId(item?.currency) === '');
            if (emptyLedgerCurrencies.length) {
                issues.push(makeIssue(
                    'empty-ledger-currency',
                    'warning',
                    '流水币种为空',
                    emptyLedgerCurrencies.map(item => ({ id: item.id || '', amount: item.amount ?? '', fallback: defaultCurrency })),
                    '当前页面会按默认金币兜底，但 habit-app 长期需要稳定 currencyId。'
                ));
            }

            const emptyRewardCurrencies = rewards.filter(item => normalizeId(item?.currency) === '');
            if (emptyRewardCurrencies.length) {
                issues.push(makeIssue(
                    'empty-reward-currency',
                    'warning',
                    '心愿币种为空',
                    emptyRewardCurrencies.map(item => ({ id: item.id || '', name: item.name || '', fallback: defaultCurrency })),
                    '心愿兑换需要明确币种，否则多币种钱包会出现歧义。'
                ));
            }

            const futureCheckins = checkins.filter(item => normalizeId(item?.date) && item.date > today);
            if (futureCheckins.length) {
                issues.push(makeIssue(
                    'future-checkins',
                    'warning',
                    '未来日期打卡',
                    futureCheckins.map(item => ({ id: item.id || '', habitId: item.habitId || '', date: item.date || '' })),
                    '未来打卡可能来自设备时间错误，补卡导入前建议复核。'
                ));
            }

            const dueToday = habits.filter(habit => isHabitDueOnDate(habit, today));
            const doneToday = dueToday.filter(habit => {
                const target = getHabitTargetCount(habit);
                const count = checkins.filter(item => item.habitId === habit.id && item.date === today).length;
                return count >= target;
            });
            const partialToday = dueToday.filter(habit => {
                const target = getHabitTargetCount(habit);
                const count = checkins.filter(item => item.habitId === habit.id && item.date === today).length;
                return count > 0 && count < target;
            });
            const deletedHabitItems = deletedItems.filter(item => ['habits', 'habit'].includes(getDeletedKind(item)));
            const deletedCheckinItems = deletedItems.filter(item => ['checkins', 'checkin'].includes(getDeletedKind(item)));

            return {
                generatedAt: new Date().toISOString(),
                readOnly: true,
                authority: 'lifePlanData legacy habit fields',
                summary: {
                    habits: habits.length,
                    checkins: checkins.length,
                    habitPointLedger: ledger.length,
                    habitRewards: rewards.length,
                    habitCurrencies: currencies.length,
                    deletedItems: deletedItems.length,
                    deletedHabitItems: deletedHabitItems.length,
                    deletedCheckinItems: deletedCheckinItems.length,
                    dueToday: dueToday.length,
                    doneToday: doneToday.length,
                    partialToday: partialToday.length,
                    recentCheckins: checkins.filter(item => lastSevenDates.has(item?.date)).length,
                    walletBalances: getWalletBalances(ledger)
                },
                issues,
                mappingPreview: [
                    { legacy: 'habits', target: 'habits', count: habits.length, note: '习惯规则、标签、奖励扣分配置' },
                    { legacy: 'checkins', target: 'habitRecords', count: checkins.length, note: '普通打卡、补卡、备注打卡历史' },
                    { legacy: 'habitPointLedger', target: 'habitLedger', count: ledger.length, note: '钱包流水；未来需补 deterministic sourceId' },
                    { legacy: 'habitRewards', target: 'habitRewards', count: rewards.length, note: '心愿、库存、兑换次数' },
                    { legacy: 'habitCurrencies', target: 'habitCurrencies', count: currencies.length, note: '当前仍以名称为主，后续映射 currencyId' },
                    { legacy: 'deletedItems', target: 'deletedItems', count: deletedItems.length, note: '旧 tombstone，仅预览不上传' }
                ],
                samples: {
                    habits: habits.slice(0, 5).map(item => ({ id: item.id || '', name: item.name || '', tag: item.tag || '' })),
                    orphanCheckins: capDetails(orphanCheckins.map(item => ({ id: item.id || '', habitId: item.habitId || '', date: item.date || '' })))
                }
            };
        }

        return {
            buildLegacyHabitDiagnostics
        };
    }

    window.LifePlanHabitService = { create };
})();
