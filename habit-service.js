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

    function stableRemoteId(collection, id, fallbackIndex) {
        const raw = normalizeId(id) || `row-${fallbackIndex + 1}`;
        return `life-plan/${collection}/${encodeURIComponent(raw)}`;
    }

    function keepOrBuildRemoteId(collection, id, fallbackIndex) {
        const raw = normalizeId(id);
        return raw.startsWith('life-plan/') ? raw : stableRemoteId(collection, raw, fallbackIndex);
    }

    function compactObject(value) {
        return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
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

        function getSourceRef(collection, item, index) {
            return compactObject({
                app: 'life-plan-site',
                collection,
                id: normalizeId(item?.id) || `row-${index + 1}`
            });
        }

        function getGroupId(tag) {
            const name = normalizeId(tag);
            return !name || name === '未分组' ? 'default' : stableRemoteId('groups', name, 0);
        }

        function getCurrencyId(currency) {
            const name = normalizeCurrency(currency, defaultCurrency);
            return name === defaultCurrency ? 'default' : stableRemoteId('currencies', name, 0);
        }

        function getLegacyDate(item) {
            return normalizeId(item?.date || item?.startDate || item?.createdAt || item?.updatedAt).slice(0, 10);
        }

        function getCanonicalRepeatUnit(rule) {
            if (rule === 'daily') return 'daily';
            if (rule === 'weekly-fixed' || rule === 'weekly-count') return 'weekly';
            return 'any';
        }

        function getCanonicalWeekdays(values) {
            return Array.from(new Set(asArray(values).map(value => {
                const day = parseInt(value, 10);
                if (!Number.isFinite(day) || day < 0 || day > 7) return 0;
                return day === 0 ? 7 : day;
            }).filter(day => day >= 1 && day <= 7))).sort((a, b) => a - b);
        }

        function getCanonicalRecordType(item) {
            const explicit = normalizeId(item?.recordType || item?.type);
            if (['normal', 'makeup', 'exempt', 'overdue_break', 'streak_reward', 'target_reward', 'manual_reward', 'reverse', 'adjust'].includes(explicit)) return explicit;
            const recordDate = getLegacyDate(item);
            const createdDate = normalizeId(item?.createdAt || item?.checkinAt || item?.updatedAt).slice(0, 10);
            return recordDate && createdDate && recordDate < createdDate ? 'makeup' : 'normal';
        }

        function getCanonicalLedgerType(type) {
            const mappings = {
                milestone: 'streak_reward',
                redeem: 'reward_redeem',
                miss: 'fine',
                break: 'fine',
                'reverse-penalty': 'reverse'
            };
            const mapped = mappings[type] || type || 'adjust';
            return ['checkin', 'makeup', 'exempt', 'overdue_break', 'streak_reward', 'target_reward', 'reward_redeem', 'fine', 'adjust', 'reverse'].includes(mapped)
                ? mapped
                : 'adjust';
        }

        function mapHabitDeletedItem(item, index) {
            const kind = getDeletedKind(item);
            const targetId = normalizeId(item?.itemId || item?.targetId || item?.entityId || item?.id);
            const mappings = {
                habit: ['habits', 'habits'],
                habits: ['habits', 'habits'],
                checkin: ['habitRecords', 'checkins'],
                checkins: ['habitRecords', 'checkins'],
                habitPointLedger: ['habitLedger', 'ledger'],
                habitRewards: ['habitRewards', 'rewards'],
                habitCurrencies: ['habitCurrencies', 'currencies']
            };
            const mapping = mappings[kind];
            const deletedAt = item?.deletedAt || item?.updatedAt || item?.createdAt;
            if (!mapping || !targetId || !deletedAt) return null;
            const [collection, remoteCollection] = mapping;
            const parentId = normalizeId(item?.habitId || item?.parentId);
            return compactObject({
                collection,
                id: keepOrBuildRemoteId(remoteCollection, targetId, index),
                deletedAt,
                parentId: parentId ? keepOrBuildRemoteId('habits', parentId, 0) : undefined,
                reason: item?.reason,
                name: item?.name,
                source: getSourceRef('deletedItems', item, index)
            });
        }

        function getHabitLegacySourceSlice(source = {}) {
            return {
                habits: asArray(source.habits),
                checkins: asArray(source.checkins),
                habitPointLedger: asArray(source.habitPointLedger),
                habitRewards: asArray(source.habitRewards),
                habitCurrencies: asArray(source.habitCurrencies),
                deletedItems: asArray(source.deletedItems)
            };
        }

        function getHabitSnapshotCollectionSummary(snapshot = {}) {
            return Object.fromEntries(Object.entries(snapshot)
                .filter(([, value]) => Array.isArray(value))
                .map(([key, value]) => [key, value.length]));
        }

        function buildHabitAppSnapshot(source = {}, options = {}) {
            const slice = getHabitLegacySourceSlice(source);
            const habits = slice.habits;
            const checkins = slice.checkins;
            const ledger = slice.habitPointLedger;
            const rewards = slice.habitRewards;
            const legacyCurrencies = slice.habitCurrencies;
            const deletedItems = slice.deletedItems;
            const currencyNames = new Set([normalizeCurrency(defaultCurrency, DEFAULT_CURRENCY)]);
            const mode = options.mode === 'local-mirror' ? 'local-mirror' : 'preview';
            const generatedAt = options.generatedAt || new Date().toISOString();
            const sourceHash = normalizeId(options.sourceHash);
            const habitRemoteIdMap = new Map(habits.map((item, index) => [
                normalizeId(item?.id),
                normalizeId(item?.remoteId) || stableRemoteId('habits', item?.id, index)
            ]).filter(([id]) => id));
            const checkinRemoteIdMap = new Map(checkins.map((item, index) => [
                normalizeId(item?.id),
                normalizeId(item?.remoteId) || stableRemoteId('checkins', item?.id || `${normalizeId(item?.habitId)}-${item?.date || index}`, index)
            ]).filter(([id]) => id));
            const rewardRemoteIdMap = new Map(rewards.map((item, index) => [
                normalizeId(item?.id),
                normalizeId(item?.remoteId) || stableRemoteId('rewards', item?.id, index)
            ]).filter(([id]) => id));
            const getHabitRemoteId = (id, index = 0) => habitRemoteIdMap.get(normalizeId(id)) || keepOrBuildRemoteId('habits', id, index);
            const getCheckinRemoteId = (id, index = 0) => checkinRemoteIdMap.get(normalizeId(id)) || keepOrBuildRemoteId('checkins', id, index);
            const getRewardRemoteId = (id, index = 0) => rewardRemoteIdMap.get(normalizeId(id)) || keepOrBuildRemoteId('rewards', id, index);

            legacyCurrencies.forEach(item => currencyNames.add(normalizeCurrency(item?.name || item?.currency || item?.id, defaultCurrency)));
            habits.forEach(item => {
                [item?.rewardCurrency, item?.penaltyCurrency, item?.breakPenaltyCurrency].forEach(value => currencyNames.add(normalizeCurrency(value, defaultCurrency)));
            });
            rewards.forEach(item => currencyNames.add(normalizeCurrency(item?.currency, defaultCurrency)));
            ledger.forEach(item => currencyNames.add(normalizeCurrency(item?.currency, defaultCurrency)));

            const groups = Array.from(new Set(habits.map(item => normalizeId(item?.tag)).filter(tag => tag && tag !== '未分组')))
                .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
                .map((tag, index) => compactObject({
                    id: getGroupId(tag),
                    name: tag,
                    sort: index + 1,
                    source: { app: 'life-plan-site', collection: 'habits.tag', id: tag }
                }));
            groups.unshift({
                id: 'default',
                name: '默认',
                sort: 0,
                createdAt: '1970-01-01T00:00:00.000Z',
                updatedAt: '1970-01-01T00:00:00.000Z'
            });

            const rewardRecords = ledger
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item?.type === 'redeem' && normalizeId(item?.rewardId))
                .map(({ item, index }) => {
                    const currency = normalizeCurrency(item?.currency, defaultCurrency);
                    return compactObject({
                        id: stableRemoteId('reward-records', item?.id, index),
                        rewardId: getRewardRemoteId(item.rewardId, 0),
                        redeemedAt: item?.createdAt || item?.updatedAt || item?.date,
                        amount: Math.abs(parseAmount(item?.amount).valid ? parseAmount(item.amount).value : 0),
                        currencyId: getCurrencyId(currency),
                        note: item?.note || '',
                        ledgerId: normalizeId(item?.remoteId) || stableRemoteId('ledger', item?.id, index),
                        sourceKey: `life-plan:habitPointLedger:${normalizeId(item?.id) || index + 1}`,
                        createdAt: item?.createdAt || item?.date,
                        updatedAt: item?.updatedAt || item?.createdAt || item?.date
                    });
                });
            const fineRecords = ledger
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => ['miss', 'break'].includes(item?.type) && normalizeId(item?.habitId))
                .map(({ item, index }) => {
                    const currency = normalizeCurrency(item?.currency, defaultCurrency);
                    return compactObject({
                        id: stableRemoteId('fine-records', item?.id, index),
                        habitId: getHabitRemoteId(item.habitId, 0),
                        finedAt: item?.createdAt || item?.updatedAt || item?.date,
                        amount: Math.abs(parseAmount(item?.amount).valid ? parseAmount(item.amount).value : 0),
                        currencyId: getCurrencyId(currency),
                        reason: item?.note || item?.type,
                        ledgerId: normalizeId(item?.remoteId) || stableRemoteId('ledger', item?.id, index),
                        sourceKey: `life-plan:habitPointLedger:${normalizeId(item?.id) || index + 1}`,
                        createdAt: item?.createdAt || item?.date,
                        updatedAt: item?.updatedAt || item?.createdAt || item?.date
                    });
                });
            const milestones = habits.flatMap((habit, habitIndex) => asArray(habit?.milestoneRewards)
                .map((item, milestoneIndex) => ({ item, milestoneIndex }))
                .filter(({ item }) => item?.enabled || Number(item?.rewardAmount || item?.amount || 0) > 0 || Number(item?.penaltyAmount || 0) > 0)
                .map(({ item, milestoneIndex }) => {
                    const days = Math.max(1, parseInt(item?.days || 1, 10) || 1);
                    const currency = normalizeCurrency(item?.currency, defaultCurrency);
                    return compactObject({
                        id: stableRemoteId('milestones', `${normalizeId(habit?.id) || habitIndex + 1}:${days}`, milestoneIndex),
                        habitId: getHabitRemoteId(habit?.id, habitIndex),
                        targetDays: days,
                        rewardAmount: Math.max(0, parseInt(item?.rewardAmount ?? item?.amount ?? 0, 10) || 0),
                        currencyId: getCurrencyId(currency),
                        sort: milestoneIndex,
                        label: `${days}天`,
                        createdAt: habit?.createdAt,
                        updatedAt: habit?.updatedAt || habit?.createdAt
                    });
                }));

            const snapshot = {
                schemaVersion: 1,
                generatedAt,
                habits: habits.map((item, index) => {
                    const rewardCurrency = normalizeCurrency(item?.rewardCurrency, defaultCurrency);
                    const fineCurrency = normalizeCurrency(item?.penaltyCurrency || item?.rewardCurrency, defaultCurrency);
                    const latestCheckin = checkins
                        .filter(entry => normalizeId(entry?.habitId) === normalizeId(item?.id))
                        .sort((a, b) => normalizeId(b?.checkinAt || b?.createdAt || b?.updatedAt).localeCompare(normalizeId(a?.checkinAt || a?.createdAt || a?.updatedAt)))[0];
                    return compactObject({
                        id: normalizeId(item?.remoteId) || stableRemoteId('habits', item?.id, index),
                        title: item?.name || '未命名习惯',
                        description: item?.description || '',
                        status: item?.archived ? 'archived' : 'active',
                        sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : index,
                        icon: item?.icon || '✅',
                        color: item?.color || '#6EA6E4',
                        groupId: getGroupId(item?.tag),
                        rewardAmount: Math.max(0, parseInt(item?.rewardPoints ?? 0, 10) || 0),
                        rewardCurrencyId: getCurrencyId(rewardCurrency),
                        fineAmount: Math.max(0, parseInt(item?.penaltyPoints ?? 0, 10) || 0),
                        fineCurrencyId: getCurrencyId(fineCurrency),
                        repeatUnit: getCanonicalRepeatUnit(item?.rule),
                        weekdays: getCanonicalWeekdays(item?.weekdays),
                        reminderTimes: asArray(item?.reminderTimes),
                        targetCount: Math.max(0, parseInt(item?.goalCount ?? item?.count ?? 0, 10) || 0),
                        targetRewardAmount: Math.max(0, parseInt(item?.targetRewardAmount ?? 0, 10) || 0),
                        requiredCountPerDay: getHabitTargetCount(item),
                        taskDurationSec: Math.max(0, parseInt(item?.taskDurationSec ?? 0, 10) || 0),
                        lastCheckAt: Object.prototype.hasOwnProperty.call(item || {}, 'lastCheckAt')
                            ? item.lastCheckAt
                            : (latestCheckin?.checkinAt || latestCheckin?.createdAt),
                        createdAt: item?.createdAt,
                        updatedAt: item?.updatedAt || item?.createdAt
                    });
                }),
                habitGroups: groups,
                habitRecords: checkins.map((item, index) => {
                    const habitId = normalizeId(item?.habitId);
                    const habit = habits.find(entry => normalizeId(entry?.id) === habitId);
                    const relatedLedger = ledger.find(entry => entry?.type === 'checkin' && normalizeId(entry?.sourceId) === normalizeId(item?.id));
                    const currency = normalizeCurrency(relatedLedger?.currency || habit?.rewardCurrency, defaultCurrency);
                    const recordTime = item?.checkinAt || item?.createdAt || item?.updatedAt || `${getLegacyDate(item)}T00:00:00`;
                    const recordType = getCanonicalRecordType(item);
                    const explicitRecordAmount = parseAmount(item?.amount);
                    return compactObject({
                        id: normalizeId(item?.remoteId) || stableRemoteId('checkins', item?.id || `${habitId}-${item?.date || index}`, index),
                        habitId: habitId ? getHabitRemoteId(habitId, 0) : undefined,
                        recordTime,
                        recordDate: item?.date || getLegacyDate(item),
                        amount: Math.max(0, explicitRecordAmount.valid ? explicitRecordAmount.value : (parseAmount(relatedLedger?.amount).valid ? parseAmount(relatedLedger.amount).value : 0)),
                        currencyId: getCurrencyId(currency),
                        type: recordType,
                        note: item?.note || '',
                        countsAsCompletion: ['normal', 'makeup'].includes(recordType),
                        countsForStreak: ['normal', 'makeup', 'exempt'].includes(recordType),
                        sourceKey: Object.prototype.hasOwnProperty.call(item || {}, 'sourceKey')
                            ? item.sourceKey
                            : `life-plan:checkins:${normalizeId(item?.id) || index + 1}`,
                        createdAt: item?.createdAt || item?.checkinAt,
                        updatedAt: item?.updatedAt || item?.createdAt || item?.checkinAt
                    });
                }),
                habitRewards: rewards.map((item, index) => {
                    const currency = normalizeCurrency(item?.currency, defaultCurrency);
                    return compactObject({
                        id: normalizeId(item?.remoteId) || stableRemoteId('rewards', item?.id, index),
                        name: item?.name || '未命名心愿',
                        description: item?.note || '',
                        cost: parseAmount(item?.cost).valid ? parseAmount(item.cost).value : 0,
                        currencyId: getCurrencyId(currency),
                        status: item?.archived ? 'archived' : 'active',
                        sort: index,
                        icon: item?.icon || '🎁',
                        color: item?.color || '#6EA6E4',
                        stock: item?.stock,
                        redeemedCount: item?.redeemedCount,
                        createdAt: item?.createdAt,
                        updatedAt: item?.updatedAt || item?.createdAt
                    });
                }),
                habitRewardRecords: rewardRecords,
                habitFineRecords: fineRecords,
                habitLedger: ledger.map((item, index) => {
                    const amount = parseAmount(item?.amount);
                    const currency = normalizeCurrency(item?.currency, defaultCurrency);
                    const habitId = normalizeId(item?.habitId);
                    const rewardId = normalizeId(item?.rewardId);
                    const canonicalType = getCanonicalLedgerType(item?.type);
                    const relatedRecordId = canonicalType === 'checkin' && item?.sourceId
                        ? getCheckinRemoteId(item.sourceId, 0)
                        : (canonicalType === 'reward_redeem'
                            ? stableRemoteId('reward-records', item?.id, index)
                            : (canonicalType === 'fine' ? stableRemoteId('fine-records', item?.id, index) : normalizeId(item?.sourceId || item?.id)));
                    return compactObject({
                        id: normalizeId(item?.remoteId) || stableRemoteId('ledger', item?.id, index),
                        amount: amount.valid ? amount.value : 0,
                        type: canonicalType,
                        currencyId: getCurrencyId(currency),
                        habitId: habitId ? getHabitRemoteId(habitId, 0) : undefined,
                        rewardId: rewardId ? getRewardRemoteId(rewardId, 0) : undefined,
                        sourceId: relatedRecordId,
                        date: item?.date || getLegacyDate(item),
                        note: item?.note || '',
                        createdAt: item?.createdAt || item?.date,
                        updatedAt: item?.updatedAt || item?.createdAt || item?.date
                    });
                }),
                habitCurrencies: Array.from(currencyNames)
                    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
                    .map((name, index) => compactObject({
                        id: getCurrencyId(name),
                        name,
                        icon: name === defaultCurrency ? '🪙' : '',
                        sort: name === defaultCurrency ? 0 : index + 1
                    })),
                habitMilestones: milestones,
                habitMilestoneClaims: [],
                habitOverdueEvents: [],
                habitMoodNotes: [],
                habitTimeTasks: [],
                deletedItems: deletedItems.map(mapHabitDeletedItem).filter(Boolean)
            };

            if (mode === 'preview') {
                snapshot.readOnlyPreview = true;
            } else {
                snapshot.localMirror = true;
                snapshot.remoteUploadEnabled = false;
                snapshot.mirror = compactObject({
                    mode: 'local-only',
                    reason: options.reason || 'manual-rebuild',
                    rebuiltAt: generatedAt,
                    sourceHash: sourceHash || undefined,
                    dualWriteEnabledPaths: asArray(options.dualWriteEnabledPaths)
                });
            }

            return snapshot;
        }

        function buildHabitAppSnapshotPreview(source = {}, options = {}) {
            const snapshot = buildHabitAppSnapshot(source, { ...options, mode: 'preview' });
            return {
                generatedAt: snapshot.generatedAt,
                readOnly: true,
                summary: getHabitSnapshotCollectionSummary(snapshot),
                snapshot,
                jsonText: JSON.stringify(snapshot, null, 2)
            };
        }

        function buildHabitAppLocalMirror(source = {}, options = {}) {
            const snapshot = buildHabitAppSnapshot(source, { ...options, mode: 'local-mirror' });
            return {
                generatedAt: snapshot.generatedAt,
                readOnly: false,
                remoteUploadEnabled: false,
                summary: getHabitSnapshotCollectionSummary(snapshot),
                snapshot,
                jsonText: JSON.stringify(snapshot, null, 2)
            };
        }

        function summarizeHabitAppLocalMirror(mirror = null, expectedSourceHash = '') {
            const snapshot = mirror && typeof mirror === 'object' ? mirror : null;
            const summary = snapshot ? getHabitSnapshotCollectionSummary(snapshot) : {};
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
                summary
            };
        }

        function formatWalletBalanceMap(balances) {
            const map = new Map();
            asArray(balances).forEach(item => {
                const currency = normalizeCurrency(item?.currency, defaultCurrency);
                const amount = parseAmount(item?.amount);
                if (!amount.valid) return;
                map.set(currency, (map.get(currency) || 0) + amount.value);
            });
            return map;
        }

        function buildHabitDualWriteConsistency(source = {}, mirror = null, expectedSourceHash = '') {
            const slice = getHabitLegacySourceSlice(source);
            const mirrorSummary = summarizeHabitAppLocalMirror(mirror, expectedSourceHash);
            const comparisons = [
                {
                    id: 'habits',
                    label: '习惯',
                    legacy: slice.habits.length,
                    mirror: mirrorSummary.summary.habits || 0
                },
                {
                    id: 'records',
                    label: '打卡/记录',
                    legacy: slice.checkins.length,
                    mirror: mirrorSummary.summary.habitRecords || 0
                },
                {
                    id: 'ledger',
                    label: '钱包流水',
                    legacy: slice.habitPointLedger.length,
                    mirror: mirrorSummary.summary.habitLedger || 0
                },
                {
                    id: 'rewards',
                    label: '心愿',
                    legacy: slice.habitRewards.length,
                    mirror: mirrorSummary.summary.habitRewards || 0
                },
                {
                    id: 'deletedItems',
                    label: 'Tombstone',
                    legacy: slice.deletedItems.map(mapHabitDeletedItem).filter(Boolean).length,
                    mirror: mirrorSummary.summary.deletedItems || 0
                }
            ].map(item => ({
                ...item,
                matched: item.legacy === item.mirror,
                delta: item.mirror - item.legacy
            }));

            const legacyBalances = formatWalletBalanceMap(getWalletBalances(slice.habitPointLedger));
            const mirrorBalances = formatWalletBalanceMap(getWalletBalances(asArray(mirror?.habitLedger)));
            const currencyNames = Array.from(new Set([
                ...legacyBalances.keys(),
                ...mirrorBalances.keys()
            ])).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
            const balances = currencyNames.map(currency => {
                const legacy = legacyBalances.get(currency) || 0;
                const mirrorAmount = mirrorBalances.get(currency) || 0;
                return {
                    currency,
                    legacy,
                    mirror: mirrorAmount,
                    matched: legacy === mirrorAmount,
                    delta: mirrorAmount - legacy
                };
            });

            const mismatches = [
                ...comparisons.filter(item => !item.matched).map(item => `${item.label}不一致`),
                ...balances.filter(item => !item.matched).map(item => `${item.currency}余额不一致`)
            ];
            if (mirrorSummary.exists && !mirrorSummary.matchesSource) {
                mismatches.unshift('sourceHash 未对齐旧数据');
            }
            if (!mirrorSummary.exists) {
                mismatches.unshift('本地镜像不存在');
            }

            let status = 'matched';
            let statusLabel = '本地镜像与旧数据一致';
            if (!mirrorSummary.exists) {
                status = 'missing';
                statusLabel = '尚未生成本地镜像';
            } else if (mismatches.length) {
                status = 'drifted';
                statusLabel = '本地镜像与旧数据不一致';
            }

            return {
                generatedAt: new Date().toISOString(),
                readOnly: true,
                remoteUploadEnabled: false,
                status,
                statusLabel,
                mirror: mirrorSummary,
                comparisons,
                balances,
                mismatches,
                summary: {
                    comparisonTotal: comparisons.length,
                    comparisonMatched: comparisons.filter(item => item.matched).length,
                    balanceTotal: balances.length,
                    balanceMatched: balances.filter(item => item.matched).length,
                    mismatchCount: mismatches.length
                }
            };
        }

        function getHabitDualWritePathInventory() {
            return [
                {
                    id: 'toggle-checkin',
                    label: '打卡 / 取消打卡',
                    fn: 'toggleCheckin',
                    legacyTargets: ['checkins', 'habitPointLedger', 'habits.updatedAt'],
                    snapshotTargets: ['habitRecords', 'habitLedger', 'habits'],
                    priority: 1,
                    dualWrite: 'enabled',
                    note: '含每日 1 次切换与多次 +1；会触发奖励、里程碑和扣分冲销。本地镜像全量重建，不上传云端。'
                },
                {
                    id: 'decrease-checkin',
                    label: '减少一次打卡',
                    fn: 'decreaseCheckin',
                    legacyTargets: ['checkins', 'habitPointLedger', 'habits.updatedAt'],
                    snapshotTargets: ['habitRecords', 'habitLedger', 'habits'],
                    priority: 1,
                    dualWrite: 'enabled',
                    note: '撤销最近一次打卡并反冲相关奖励。本地镜像全量重建，不上传云端。'
                },
                {
                    id: 'append-checkin',
                    label: '快速打卡 / 备注打卡',
                    fn: 'appendHabitCheckin',
                    legacyTargets: ['checkins', 'habitPointLedger', 'habits.updatedAt'],
                    snapshotTargets: ['habitRecords', 'habitLedger', 'habits'],
                    priority: 1,
                    dualWrite: 'enabled',
                    note: '今日打卡、备注打卡与补卡共用入口。本地镜像全量重建，不上传云端。'
                },
                {
                    id: 'edit-checkin-note',
                    label: '编辑打卡备注',
                    fn: 'submitHabitNoteModal',
                    legacyTargets: ['checkins', 'habits.updatedAt'],
                    snapshotTargets: ['habitRecords', 'habits'],
                    priority: 2,
                    dualWrite: 'enabled',
                    note: '仅更新备注文本时也重建本地镜像；新建备注打卡走 append-checkin。'
                },
                {
                    id: 'save-habit',
                    label: '新建 / 编辑习惯',
                    fn: 'saveHabit',
                    legacyTargets: ['habits', 'habitCurrencies'],
                    snapshotTargets: ['habits', 'habitGroups', 'habitCurrencies'],
                    priority: 1,
                    dualWrite: 'enabled',
                    note: '规则、标签、奖励与扣分配置变更；本地镜像全量重建。'
                },
                {
                    id: 'delete-habit',
                    label: '删除习惯',
                    fn: 'deleteCurrentHabit',
                    legacyTargets: ['habits', 'checkins', 'deletedItems', 'records'],
                    snapshotTargets: ['habits', 'habitRecords', 'deletedItems'],
                    priority: 2,
                    dualWrite: 'enabled',
                    note: '旧路径仍会硬删历史；本地镜像同步重建 tombstone 预览。'
                },
                {
                    id: 'save-reward',
                    label: '新增心愿',
                    fn: 'saveHabitReward',
                    legacyTargets: ['habitRewards', 'habitCurrencies'],
                    snapshotTargets: ['habitRewards', 'habitCurrencies'],
                    priority: 2,
                    dualWrite: 'enabled',
                    note: '心愿商品入库；本地镜像全量重建。'
                },
                {
                    id: 'redeem-reward',
                    label: '兑换心愿',
                    fn: 'redeemHabitReward',
                    legacyTargets: ['habitRewards', 'habitPointLedger'],
                    snapshotTargets: ['habitRewards', 'habitLedger', 'habitRewardRecords'],
                    priority: 1,
                    dualWrite: 'enabled',
                    note: '扣库存、写兑换流水；本地镜像全量重建，不上传云端。'
                },
                {
                    id: 'adjust-points',
                    label: '手动加减积分',
                    fn: 'saveHabitPointAdjust',
                    legacyTargets: ['habitPointLedger', 'habitCurrencies'],
                    snapshotTargets: ['habitLedger', 'habitCurrencies'],
                    priority: 2,
                    dualWrite: 'enabled',
                    note: '钱包手动调整；本地镜像全量重建。'
                },
                {
                    id: 'settle-penalties',
                    label: '结算昨日扣分',
                    fn: 'settleHabitPenaltiesThroughYesterday',
                    legacyTargets: ['habitPointLedger'],
                    snapshotTargets: ['habitLedger', 'habitFineRecords', 'habitOverdueEvents'],
                    priority: 2,
                    dualWrite: 'enabled',
                    note: 'miss/break 罚款；有变更时重建本地镜像，后续仍要避免双端重复结算。'
                },
                {
                    id: 'manage-currency',
                    label: '币种管理',
                    fn: 'addHabitCurrencyFromModal',
                    legacyTargets: ['habitCurrencies'],
                    snapshotTargets: ['habitCurrencies'],
                    priority: 3,
                    dualWrite: 'enabled',
                    note: '新增/规范化币种名称；本地镜像全量重建。'
                }
            ];
        }

        function buildHabitDualWriteReadiness(source = {}, diagnostics = null) {
            const report = diagnostics || buildLegacyHabitDiagnostics(source);
            const issues = asArray(report.issues);
            const dangerIssues = issues.filter(item => item?.severity === 'danger');
            const warningIssues = issues.filter(item => item?.severity === 'warning');
            const writePaths = getHabitDualWritePathInventory();
            const pendingPaths = writePaths.filter(item => item.dualWrite !== 'enabled');
            const enabledPaths = writePaths.filter(item => item.dualWrite === 'enabled');
            const blockers = [];

            if (dangerIssues.length) {
                blockers.push({
                    id: 'danger-diagnostics',
                    label: '诊断页仍有高风险项',
                    count: dangerIssues.length,
                    details: dangerIssues.map(item => item.label),
                    hint: '先处理重复 ID、孤儿打卡、异常金额等高风险问题，再开启本地双写。'
                });
            }

            if (enabledPaths.length === 0) {
                blockers.push({
                    id: 'no-dual-write-hooks',
                    label: '写路径尚未接入本地双写',
                    count: pendingPaths.length,
                    details: pendingPaths.slice(0, 6).map(item => item.label),
                    hint: '按优先级逐个接入 toggleCheckin / decreaseCheckin / appendHabitCheckin 等写路径，不直接上传云端。'
                });
            } else if (pendingPaths.length) {
                blockers.push({
                    id: 'partial-dual-write-hooks',
                    label: '仍有写路径未接入本地双写',
                    count: pendingPaths.length,
                    details: pendingPaths.slice(0, 6).map(item => item.label),
                    hint: '打卡相关路径已本地双写；继续接入钱包、习惯编辑等路径，仍不上传云端。'
                });
            }

            let status = 'ready';
            let statusLabel = '本地双写已全部接入';
            if (dangerIssues.length) {
                status = 'blocked';
                statusLabel = '被高风险数据阻塞';
            } else if (enabledPaths.length === 0) {
                status = 'prepared';
                statusLabel = '前置检查通过，等待接入写路径';
            } else if (pendingPaths.length) {
                status = 'partial';
                statusLabel = `本地双写部分接入 ${enabledPaths.length}/${writePaths.length}`;
            }

            return {
                generatedAt: new Date().toISOString(),
                readOnly: true,
                phase: 'phase-4-local-dual-write',
                remoteUploadEnabled: false,
                authority: 'lifePlanData legacy habit fields',
                status,
                statusLabel,
                summary: {
                    writePathTotal: writePaths.length,
                    writePathEnabled: enabledPaths.length,
                    writePathPending: pendingPaths.length,
                    dangerIssueCount: dangerIssues.length,
                    warningIssueCount: warningIssues.length,
                    blockerCount: blockers.length
                },
                blockers,
                writePaths,
                nextActions: enabledPaths.length === writePaths.length
                ? [
                    '全部写路径已会重建 localStorage.habitAppData，仍不上传 /apps/habit-app/data.json。',
                    '下一步补一致性校验面板：records / ledger 数量与余额。',
                    '本地双写稳定后，再引入独立 habitSyncConfig 与远端 path。',
                    '远端同步前继续保持 Worker 无业务合并逻辑。'
                ]
                : (enabledPaths.length
                    ? [
                        '部分写路径已会重建 localStorage.habitAppData，仍不上传 /apps/habit-app/data.json。',
                        '继续接入剩余写路径。',
                        '每个新写路径接入后校验 habitRecords / habitLedger 数量与余额一致性。',
                        '全部本地写路径稳定后，再引入独立 habitSyncConfig。'
                    ]
                    : [
                        '保持只读预览与诊断，不上传 /apps/habit-app/data.json。',
                        '优先接入 toggleCheckin、decreaseCheckin、appendHabitCheckin 的本地双写。',
                        '每个写路径接入后校验 habitRecords / habitLedger 数量与余额一致性。',
                        '全部本地写路径稳定后，再引入独立 habitSyncConfig。'
                    ])
            };
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
                    { legacy: 'deletedItems', target: 'deletedItems', count: deletedItems.length, note: '仅习惯相关删除标记会转换为 canonical tombstone' }
                ],
                samples: {
                    habits: habits.slice(0, 5).map(item => ({ id: item.id || '', name: item.name || '', tag: item.tag || '' })),
                    orphanCheckins: capDetails(orphanCheckins.map(item => ({ id: item.id || '', habitId: item.habitId || '', date: item.date || '' })))
                }
            };
        }

        return {
            buildLegacyHabitDiagnostics,
            buildHabitAppSnapshot,
            buildHabitAppSnapshotPreview,
            buildHabitAppLocalMirror,
            summarizeHabitAppLocalMirror,
            buildHabitDualWriteConsistency,
            getHabitLegacySourceSlice,
            getHabitDualWritePathInventory,
            buildHabitDualWriteReadiness
        };
    }

    window.LifePlanHabitService = { create };
})();
