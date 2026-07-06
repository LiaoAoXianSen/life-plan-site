(function () {
    const DEFAULT_CURRENCY = '金币';
    const MILESTONE_DAYS = [7, 15, 21, 30, 90, 180, 365];
    const MILESTONE_LABELS = {
        7: '一周',
        15: '15天',
        21: '21天',
        30: '30天',
        90: '一个季度',
        180: '半年',
        365: '一年'
    };

    function normalizeCurrency(value) {
        const text = String(value || '').trim();
        return text || DEFAULT_CURRENCY;
    }

    function formatCurrencyAmount(amount, currency = DEFAULT_CURRENCY) {
        return `${amount} ${normalizeCurrency(currency)}`;
    }

    function getMilestoneDefaults() {
        return MILESTONE_DAYS.map(days => ({
            days,
            enabled: false,
            rewardAmount: 0,
            currency: DEFAULT_CURRENCY,
            penaltyAmount: 0,
            penaltyCurrency: DEFAULT_CURRENCY
        }));
    }

    function normalizeMilestoneRewards(milestones = []) {
        const byDays = {};
        if (Array.isArray(milestones)) {
            milestones.forEach(item => {
                const days = parseInt(item?.days || 0, 10) || 0;
                if (MILESTONE_DAYS.includes(days)) byDays[days] = item;
            });
        }
        return getMilestoneDefaults().map(defaultItem => {
            const item = byDays[defaultItem.days] || {};
            const rewardAmount = Math.max(0, parseInt(item.rewardAmount ?? item.amount ?? 0, 10) || 0);
            const penaltyAmount = Math.max(0, parseInt(item.penaltyAmount ?? 0, 10) || 0);
            return {
                days: defaultItem.days,
                enabled: !!(item.enabled || rewardAmount > 0 || penaltyAmount > 0),
                rewardAmount,
                currency: normalizeCurrency(item.currency),
                penaltyAmount,
                penaltyCurrency: normalizeCurrency(item.penaltyCurrency || item.currency)
            };
        });
    }

    function getBalances(ledger = []) {
        const balances = {};
        ledger.forEach(entry => {
            const currency = normalizeCurrency(entry.currency);
            balances[currency] = (balances[currency] || 0) + (parseInt(entry.amount || 0, 10) || 0);
        });
        if (!Object.keys(balances).length) balances[DEFAULT_CURRENCY] = 0;
        return balances;
    }

    function getCyclePosition(streak, cycleLength) {
        if (!cycleLength || streak <= 0) return null;
        return {
            cycleLength,
            cycleIndex: Math.floor((streak - 1) / cycleLength),
            dayInCycle: ((streak - 1) % cycleLength) + 1
        };
    }

    window.HabitEngine = {
        DEFAULT_CURRENCY,
        MILESTONE_DAYS,
        MILESTONE_LABELS,
        normalizeCurrency,
        formatCurrencyAmount,
        getMilestoneDefaults,
        normalizeMilestoneRewards,
        getBalances,
        getCyclePosition
    };
})();
