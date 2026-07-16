(function () {
    const METRIC_FIELDS = [
        { key: 'weight', label: '体重', unit: 'kg', step: '0.1' },
        { key: 'bodyFat', label: '体脂', unit: '%', step: '0.1' },
        { key: 'chest', label: '胸围', unit: 'cm', step: '0.1' },
        { key: 'waist', label: '腰围', unit: 'cm', step: '0.1' },
        { key: 'hips', label: '臀围', unit: 'cm', step: '0.1' },
        { key: 'leftArm', label: '左臂围', unit: 'cm', step: '0.1' },
        { key: 'rightArm', label: '右臂围', unit: 'cm', step: '0.1' },
        { key: 'leftThigh', label: '左大腿围', unit: 'cm', step: '0.1' },
        { key: 'rightThigh', label: '右大腿围', unit: 'cm', step: '0.1' },
        { key: 'calf', label: '小腿围', unit: 'cm', step: '0.1' },
        { key: 'shoulder', label: '肩围', unit: 'cm', step: '0.1' },
        { key: 'height', label: '身高', unit: 'cm', step: '0.1' }
    ];

    const CONDITION_OPTIONS = [
        { value: 'unknown', label: '不确定' },
        { value: 'fasted', label: '空腹' },
        { value: 'afterMeal', label: '饭后' }
    ];

    function create(options = {}) {
        const {
            getTodayStr = () => new Date().toISOString().slice(0, 10),
            getNowLocal = () => new Date().toISOString(),
            genId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
        } = options;

        function parseMetricNumber(value) {
            if (value === '' || value === null || value === undefined) return null;
            const num = Number(value);
            return Number.isFinite(num) ? Math.round(num * 10) / 10 : null;
        }

        function hasAnyMetric(metric = {}) {
            return METRIC_FIELDS.some(field => parseMetricNumber(metric[field.key]) !== null);
        }

        function normalizeBodyMetric(raw = {}, fallback = {}) {
            const createdAt = raw.createdAt || fallback.createdAt || getNowLocal();
            const date = String(raw.date || fallback.date || getTodayStr()).slice(0, 10);
            const metric = {
                id: raw.id || fallback.id || genId(),
                date,
                measuredAt: raw.measuredAt || fallback.measuredAt || `${date}T08:00:00`,
                condition: CONDITION_OPTIONS.some(item => item.value === raw.condition)
                    ? raw.condition
                    : (fallback.condition || 'unknown'),
                note: typeof raw.note === 'string' ? raw.note : (fallback.note || ''),
                createdAt,
                updatedAt: raw.updatedAt || fallback.updatedAt || createdAt
            };
            METRIC_FIELDS.forEach(field => {
                const value = parseMetricNumber(raw[field.key] ?? fallback[field.key]);
                if (value !== null) metric[field.key] = value;
                else delete metric[field.key];
            });
            return metric;
        }

        function normalizeBodyMetrics(list = []) {
            return (Array.isArray(list) ? list : [])
                .map(item => normalizeBodyMetric(item))
                .filter(item => item.id && item.date && hasAnyMetric(item))
                .sort((a, b) => {
                    const dateDiff = String(b.date || '').localeCompare(String(a.date || ''));
                    if (dateDiff) return dateDiff;
                    return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
                });
        }

        function normalizeFitnessData(target = {}) {
            if (!target || typeof target !== 'object') return target;
            if (!Array.isArray(target.bodyMetrics)) target.bodyMetrics = [];
            if (!Array.isArray(target.fitnessPlans)) target.fitnessPlans = [];
            if (!Array.isArray(target.fitnessWorkouts)) target.fitnessWorkouts = [];
            target.bodyMetrics = normalizeBodyMetrics(target.bodyMetrics);
            return target;
        }

        function formatMetricValue(value, unit = '') {
            if (value === null || value === undefined || value === '') return '—';
            const num = Number(value);
            if (!Number.isFinite(num)) return '—';
            const text = Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
            return unit ? `${text} ${unit}` : text;
        }

        function formatSignedChange(value, unit = '') {
            if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
            const num = Number(value);
            const prefix = num > 0 ? '+' : '';
            return `${prefix}${formatMetricValue(num, unit)}`;
        }

        function getConditionLabel(value = 'unknown') {
            return CONDITION_OPTIONS.find(item => item.value === value)?.label || '不确定';
        }

        function getLatestBodyMetric(list = []) {
            return normalizeBodyMetrics(list)[0] || null;
        }

        function getMetricSeries(list = [], field = 'weight', limit = 12) {
            return normalizeBodyMetrics(list)
                .filter(item => parseMetricNumber(item[field]) !== null)
                .slice(0, limit)
                .reverse()
                .map(item => ({
                    id: item.id,
                    date: item.date,
                    value: parseMetricNumber(item[field])
                }));
        }

        function getMetricChange(list = [], field = 'weight', days = 30) {
            const series = getMetricSeries(list, field, 365);
            if (series.length < 2) {
                return {
                    latest: series[series.length - 1] || null,
                    previous: null,
                    delta: null,
                    days
                };
            }
            const latest = series[series.length - 1];
            const threshold = (() => {
                const date = new Date(`${latest.date}T00:00:00`);
                date.setDate(date.getDate() - days);
                return date.toISOString().slice(0, 10);
            })();
            let previous = null;
            for (let i = series.length - 2; i >= 0; i -= 1) {
                if (series[i].date <= threshold || i === 0) {
                    previous = series[i];
                    break;
                }
            }
            if (!previous) previous = series[0];
            return {
                latest,
                previous,
                delta: latest && previous ? Math.round((latest.value - previous.value) * 10) / 10 : null,
                days
            };
        }

        function buildBodyMetricSummary(list = []) {
            const metrics = normalizeBodyMetrics(list);
            const latest = metrics[0] || null;
            const weightChange = getMetricChange(metrics, 'weight', 30);
            const waistChange = getMetricChange(metrics, 'waist', 30);
            const bodyFatChange = getMetricChange(metrics, 'bodyFat', 30);
            return {
                count: metrics.length,
                latest,
                weightChange,
                waistChange,
                bodyFatChange,
                weightSeries: getMetricSeries(metrics, 'weight', 10),
                waistSeries: getMetricSeries(metrics, 'waist', 10)
            };
        }

        function createBodyMetricDraft(overrides = {}) {
            return normalizeBodyMetric({
                date: getTodayStr(),
                condition: 'fasted',
                note: '',
                ...overrides
            });
        }

        function validateBodyMetricInput(input = {}) {
            const metric = normalizeBodyMetric(input);
            if (!metric.date) return { ok: false, message: '请填写测量日期', metric };
            if (!hasAnyMetric(metric)) return { ok: false, message: '请至少填写一个身材指标', metric };
            return { ok: true, message: '', metric };
        }

        function upsertBodyMetric(list = [], input = {}, existingId = '') {
            const validation = validateBodyMetricInput(input);
            if (!validation.ok) return validation;
            const metrics = normalizeBodyMetrics(list);
            const stamp = getNowLocal();
            if (existingId) {
                const index = metrics.findIndex(item => item.id === existingId);
                if (index >= 0) {
                    metrics[index] = normalizeBodyMetric({
                        ...metrics[index],
                        ...validation.metric,
                        id: existingId,
                        createdAt: metrics[index].createdAt,
                        updatedAt: stamp
                    });
                    return { ok: true, message: '', metrics: normalizeBodyMetrics(metrics), metric: metrics[index] };
                }
            }
            const metric = normalizeBodyMetric({
                ...validation.metric,
                id: genId(),
                createdAt: stamp,
                updatedAt: stamp
            });
            return { ok: true, message: '', metrics: normalizeBodyMetrics([metric, ...metrics]), metric };
        }

        function removeBodyMetric(list = [], metricId = '') {
            return normalizeBodyMetrics(list).filter(item => item.id !== metricId);
        }

        function findSameDayMetrics(list = [], date = '', excludeId = '') {
            return normalizeBodyMetrics(list).filter(item => item.date === date && item.id !== excludeId);
        }

        return {
            METRIC_FIELDS,
            CONDITION_OPTIONS,
            parseMetricNumber,
            hasAnyMetric,
            normalizeBodyMetric,
            normalizeBodyMetrics,
            normalizeFitnessData,
            formatMetricValue,
            formatSignedChange,
            getConditionLabel,
            getLatestBodyMetric,
            getMetricSeries,
            getMetricChange,
            buildBodyMetricSummary,
            createBodyMetricDraft,
            validateBodyMetricInput,
            upsertBodyMetric,
            removeBodyMetric,
            findSameDayMetrics
        };
    }

    window.LifePlanFitnessService = {
        create,
        METRIC_FIELDS,
        CONDITION_OPTIONS
    };
})();
