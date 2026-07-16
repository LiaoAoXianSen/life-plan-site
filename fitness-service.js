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

    const PLAN_GOAL_OPTIONS = [
        { value: 'general', label: '综合提升' },
        { value: 'strength', label: '力量' },
        { value: 'hypertrophy', label: '增肌' },
        { value: 'fatLoss', label: '减脂' },
        { value: 'endurance', label: '耐力' }
    ];

    const PLAN_STATUS_OPTIONS = [
        { value: 'active', label: '进行中' },
        { value: 'paused', label: '暂停' },
        { value: 'archived', label: '归档' }
    ];

    const WORKOUT_STATUS_OPTIONS = [
        { value: 'planned', label: '计划中' },
        { value: 'done', label: '已完成' },
        { value: 'skipped', label: '已跳过' }
    ];

    const WEEKDAY_OPTIONS = [
        { value: 1, label: '周一' },
        { value: 2, label: '周二' },
        { value: 3, label: '周三' },
        { value: 4, label: '周四' },
        { value: 5, label: '周五' },
        { value: 6, label: '周六' },
        { value: 0, label: '周日' }
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

        function parsePositiveInt(value, fallback = null) {
            if (value === '' || value === null || value === undefined) return fallback;
            const num = Number(value);
            if (!Number.isFinite(num) || num <= 0) return fallback;
            return Math.round(num);
        }

        function parseNonNegativeNumber(value, fallback = null) {
            if (value === '' || value === null || value === undefined) return fallback;
            const num = Number(value);
            if (!Number.isFinite(num) || num < 0) return fallback;
            return Math.round(num * 10) / 10;
        }

        function normalizeWeekdays(list = []) {
            const values = (Array.isArray(list) ? list : [])
                .map(item => Number(item))
                .filter(item => Number.isInteger(item) && item >= 0 && item <= 6);
            return Array.from(new Set(values)).sort((a, b) => {
                const orderA = a === 0 ? 7 : a;
                const orderB = b === 0 ? 7 : b;
                return orderA - orderB;
            });
        }

        function normalizeExercise(raw = {}, fallback = {}) {
            const name = String(raw.name ?? fallback.name ?? '').trim();
            const exercise = {
                id: raw.id || fallback.id || genId(),
                name,
                targetSets: parsePositiveInt(raw.targetSets ?? fallback.targetSets, 3) || 3,
                targetReps: String(raw.targetReps ?? fallback.targetReps ?? '8-12').trim() || '8-12',
                note: typeof (raw.note ?? fallback.note) === 'string' ? String(raw.note ?? fallback.note) : ''
            };
            const targetWeight = parseNonNegativeNumber(raw.targetWeight ?? fallback.targetWeight, null);
            if (targetWeight !== null) exercise.targetWeight = targetWeight;
            const restSec = parsePositiveInt(raw.restSec ?? fallback.restSec, null);
            if (restSec !== null) exercise.restSec = restSec;
            return exercise;
        }

        function normalizePlanDay(raw = {}, fallback = {}, index = 0) {
            const exercises = (Array.isArray(raw.exercises) ? raw.exercises : (fallback.exercises || []))
                .map(item => normalizeExercise(item))
                .filter(item => item.name);
            return {
                id: raw.id || fallback.id || genId(),
                name: String(raw.name ?? fallback.name ?? `训练日 ${index + 1}`).trim() || `训练日 ${index + 1}`,
                exercises
            };
        }

        function normalizeFitnessPlan(raw = {}, fallback = {}) {
            const createdAt = raw.createdAt || fallback.createdAt || getNowLocal();
            const daysSource = Array.isArray(raw.days) ? raw.days : (fallback.days || []);
            const days = daysSource
                .map((item, index) => normalizePlanDay(item, {}, index))
                .filter(item => item.name);
            const goal = PLAN_GOAL_OPTIONS.some(item => item.value === raw.goal)
                ? raw.goal
                : (PLAN_GOAL_OPTIONS.some(item => item.value === fallback.goal) ? fallback.goal : 'general');
            const status = PLAN_STATUS_OPTIONS.some(item => item.value === raw.status)
                ? raw.status
                : (PLAN_STATUS_OPTIONS.some(item => item.value === fallback.status) ? fallback.status : 'active');
            return {
                id: raw.id || fallback.id || genId(),
                name: String(raw.name ?? fallback.name ?? '').trim(),
                goal,
                status,
                weekdays: normalizeWeekdays(raw.weekdays ?? fallback.weekdays ?? []),
                notes: typeof (raw.notes ?? fallback.notes) === 'string' ? String(raw.notes ?? fallback.notes) : '',
                days,
                createdAt,
                updatedAt: raw.updatedAt || fallback.updatedAt || createdAt
            };
        }

        function normalizeFitnessPlans(list = []) {
            return (Array.isArray(list) ? list : [])
                .map(item => normalizeFitnessPlan(item))
                .filter(item => item.id && item.name)
                .sort((a, b) => {
                    const statusOrder = { active: 0, paused: 1, archived: 2 };
                    const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
                    if (statusDiff) return statusDiff;
                    return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
                });
        }

        function normalizeWorkoutSet(raw = {}, fallback = {}) {
            const set = {
                id: raw.id || fallback.id || genId(),
                done: raw.done === true || fallback.done === true
            };
            const weight = parseNonNegativeNumber(raw.weight ?? fallback.weight, null);
            if (weight !== null) set.weight = weight;
            const reps = parsePositiveInt(raw.reps ?? fallback.reps, null);
            if (reps !== null) set.reps = reps;
            const rpe = parseNonNegativeNumber(raw.rpe ?? fallback.rpe, null);
            if (rpe !== null) set.rpe = rpe;
            return set;
        }

        function createDefaultSets(count = 3, template = {}) {
            const size = parsePositiveInt(count, 3) || 3;
            return Array.from({ length: size }, () => normalizeWorkoutSet({
                weight: template.targetWeight,
                reps: parsePositiveInt(String(template.targetReps || '').split(/[-~/]/)[0], null),
                done: false
            }));
        }

        function normalizeWorkoutExercise(raw = {}, fallback = {}) {
            const name = String(raw.name ?? fallback.name ?? '').trim();
            const setsSource = Array.isArray(raw.sets)
                ? raw.sets
                : (Array.isArray(fallback.sets) ? fallback.sets : createDefaultSets(raw.targetSets ?? fallback.targetSets ?? 3, raw));
            const sets = setsSource.map(item => normalizeWorkoutSet(item)).filter(Boolean);
            const exercise = {
                id: raw.id || fallback.id || genId(),
                name,
                targetSets: parsePositiveInt(raw.targetSets ?? fallback.targetSets, sets.length || 3) || (sets.length || 3),
                targetReps: String(raw.targetReps ?? fallback.targetReps ?? '').trim(),
                note: typeof (raw.note ?? fallback.note) === 'string' ? String(raw.note ?? fallback.note) : '',
                sets: sets.length ? sets : createDefaultSets(3, raw)
            };
            const targetWeight = parseNonNegativeNumber(raw.targetWeight ?? fallback.targetWeight, null);
            if (targetWeight !== null) exercise.targetWeight = targetWeight;
            return exercise;
        }

        function normalizeFitnessWorkout(raw = {}, fallback = {}) {
            const createdAt = raw.createdAt || fallback.createdAt || getNowLocal();
            const date = String(raw.date || fallback.date || getTodayStr()).slice(0, 10);
            const status = WORKOUT_STATUS_OPTIONS.some(item => item.value === raw.status)
                ? raw.status
                : (WORKOUT_STATUS_OPTIONS.some(item => item.value === fallback.status) ? fallback.status : 'planned');
            const exercises = (Array.isArray(raw.exercises) ? raw.exercises : (fallback.exercises || []))
                .map(item => normalizeWorkoutExercise(item))
                .filter(item => item.name);
            return {
                id: raw.id || fallback.id || genId(),
                date,
                status,
                planId: raw.planId || fallback.planId || '',
                planName: String(raw.planName ?? fallback.planName ?? '').trim(),
                dayId: raw.dayId || fallback.dayId || '',
                dayName: String(raw.dayName ?? fallback.dayName ?? '').trim(),
                title: String(raw.title ?? fallback.title ?? '').trim(),
                notes: typeof (raw.notes ?? fallback.notes) === 'string' ? String(raw.notes ?? fallback.notes) : '',
                durationMin: parsePositiveInt(raw.durationMin ?? fallback.durationMin, null),
                exercises,
                createdAt,
                updatedAt: raw.updatedAt || fallback.updatedAt || createdAt
            };
        }

        function normalizeFitnessWorkouts(list = []) {
            return (Array.isArray(list) ? list : [])
                .map(item => normalizeFitnessWorkout(item))
                .filter(item => item.id && item.date && (item.title || item.exercises.length))
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
            target.fitnessPlans = normalizeFitnessPlans(target.fitnessPlans);
            target.fitnessWorkouts = normalizeFitnessWorkouts(target.fitnessWorkouts);
            return target;
        }

        function getPlanGoalLabel(value = 'general') {
            return PLAN_GOAL_OPTIONS.find(item => item.value === value)?.label || '综合提升';
        }

        function getPlanStatusLabel(value = 'active') {
            return PLAN_STATUS_OPTIONS.find(item => item.value === value)?.label || '进行中';
        }

        function getWeekdayLabels(weekdays = []) {
            const map = new Map(WEEKDAY_OPTIONS.map(item => [item.value, item.label]));
            return normalizeWeekdays(weekdays).map(value => map.get(value)).filter(Boolean);
        }

        function countPlanExercises(plan = {}) {
            return (plan.days || []).reduce((sum, day) => sum + ((day.exercises || []).length), 0);
        }

        function createFitnessPlanDraft(overrides = {}) {
            return normalizeFitnessPlan({
                name: '',
                goal: 'general',
                status: 'active',
                weekdays: [1, 3, 5],
                notes: '',
                days: [
                    {
                        name: 'A 日',
                        exercises: [
                            { name: '深蹲', targetSets: 4, targetReps: '6-8' },
                            { name: '卧推', targetSets: 4, targetReps: '6-8' }
                        ]
                    }
                ],
                ...overrides
            });
        }

        function validateFitnessPlanInput(input = {}) {
            const plan = normalizeFitnessPlan(input);
            if (!plan.name) return { ok: false, message: '请填写计划名称', plan };
            if (!plan.days.length) return { ok: false, message: '请至少添加一个训练日', plan };
            if (plan.days.some(day => !day.exercises.length)) {
                return { ok: false, message: '每个训练日至少要有一个动作', plan };
            }
            return { ok: true, message: '', plan };
        }

        function upsertFitnessPlan(list = [], input = {}, existingId = '') {
            const validation = validateFitnessPlanInput(input);
            if (!validation.ok) return validation;
            const plans = normalizeFitnessPlans(list);
            const stamp = getNowLocal();
            if (existingId) {
                const index = plans.findIndex(item => item.id === existingId);
                if (index >= 0) {
                    plans[index] = normalizeFitnessPlan({
                        ...plans[index],
                        ...validation.plan,
                        id: existingId,
                        createdAt: plans[index].createdAt,
                        updatedAt: stamp
                    });
                    return { ok: true, message: '', plans: normalizeFitnessPlans(plans), plan: plans[index] };
                }
            }
            const plan = normalizeFitnessPlan({
                ...validation.plan,
                id: genId(),
                createdAt: stamp,
                updatedAt: stamp
            });
            return { ok: true, message: '', plans: normalizeFitnessPlans([plan, ...plans]), plan };
        }

        function removeFitnessPlan(list = [], planId = '') {
            return normalizeFitnessPlans(list).filter(item => item.id !== planId);
        }

        function getActiveFitnessPlans(list = []) {
            return normalizeFitnessPlans(list).filter(item => item.status === 'active');
        }

        function findFitnessPlan(list = [], planId = '') {
            return normalizeFitnessPlans(list).find(item => item.id === planId) || null;
        }

        function getWorkoutStatusLabel(value = 'planned') {
            return WORKOUT_STATUS_OPTIONS.find(item => item.value === value)?.label || '计划中';
        }

        function getWorkoutTitle(workout = {}) {
            if (workout.title) return workout.title;
            if (workout.planName && workout.dayName) return `${workout.planName} · ${workout.dayName}`;
            if (workout.dayName) return workout.dayName;
            if (workout.planName) return workout.planName;
            return '自由训练';
        }

        function countCompletedSets(workout = {}) {
            return (workout.exercises || []).reduce((sum, exercise) => {
                return sum + (exercise.sets || []).filter(set => set.done).length;
            }, 0);
        }

        function countTotalSets(workout = {}) {
            return (workout.exercises || []).reduce((sum, exercise) => sum + ((exercise.sets || []).length), 0);
        }

        function createWorkoutFromPlanDay(plan = {}, day = {}, overrides = {}) {
            const sourcePlan = normalizeFitnessPlan(plan);
            const sourceDay = normalizePlanDay(day);
            return normalizeFitnessWorkout({
                date: getTodayStr(),
                status: 'planned',
                planId: sourcePlan.id || '',
                planName: sourcePlan.name || '',
                dayId: sourceDay.id || '',
                dayName: sourceDay.name || '',
                title: sourcePlan.name && sourceDay.name
                    ? `${sourcePlan.name} · ${sourceDay.name}`
                    : (sourceDay.name || sourcePlan.name || '今日训练'),
                notes: '',
                exercises: (sourceDay.exercises || []).map(exercise => normalizeWorkoutExercise({
                    name: exercise.name,
                    targetSets: exercise.targetSets,
                    targetReps: exercise.targetReps,
                    targetWeight: exercise.targetWeight,
                    note: exercise.note,
                    sets: createDefaultSets(exercise.targetSets, exercise)
                })),
                ...overrides
            });
        }

        function createFitnessWorkoutDraft(overrides = {}) {
            return normalizeFitnessWorkout({
                date: getTodayStr(),
                status: 'planned',
                title: '自由训练',
                notes: '',
                exercises: [
                    normalizeWorkoutExercise({
                        name: '',
                        targetSets: 3,
                        targetReps: '8-12',
                        sets: createDefaultSets(3)
                    })
                ],
                ...overrides
            });
        }

        function validateFitnessWorkoutInput(input = {}) {
            const workout = normalizeFitnessWorkout(input);
            if (!workout.date) return { ok: false, message: '请填写训练日期', workout };
            if (!workout.exercises.length) return { ok: false, message: '请至少添加一个动作', workout };
            if (!workout.title) workout.title = getWorkoutTitle(workout);
            return { ok: true, message: '', workout };
        }

        function upsertFitnessWorkout(list = [], input = {}, existingId = '') {
            const validation = validateFitnessWorkoutInput(input);
            if (!validation.ok) return validation;
            const workouts = normalizeFitnessWorkouts(list);
            const stamp = getNowLocal();
            if (existingId) {
                const index = workouts.findIndex(item => item.id === existingId);
                if (index >= 0) {
                    workouts[index] = normalizeFitnessWorkout({
                        ...workouts[index],
                        ...validation.workout,
                        id: existingId,
                        createdAt: workouts[index].createdAt,
                        updatedAt: stamp
                    });
                    return { ok: true, message: '', workouts: normalizeFitnessWorkouts(workouts), workout: workouts[index] };
                }
            }
            const workout = normalizeFitnessWorkout({
                ...validation.workout,
                id: genId(),
                createdAt: stamp,
                updatedAt: stamp
            });
            return { ok: true, message: '', workouts: normalizeFitnessWorkouts([workout, ...workouts]), workout };
        }

        function removeFitnessWorkout(list = [], workoutId = '') {
            return normalizeFitnessWorkouts(list).filter(item => item.id !== workoutId);
        }

        function findFitnessWorkout(list = [], workoutId = '') {
            return normalizeFitnessWorkouts(list).find(item => item.id === workoutId) || null;
        }

        function buildWorkoutSummary(list = [], days = 30) {
            const workouts = normalizeFitnessWorkouts(list);
            const today = getTodayStr();
            const thresholdDate = (() => {
                const date = new Date(`${today}T00:00:00`);
                date.setDate(date.getDate() - days);
                return date.toISOString().slice(0, 10);
            })();
            const recent = workouts.filter(item => item.date >= thresholdDate);
            const doneCount = recent.filter(item => item.status === 'done').length;
            const plannedCount = recent.filter(item => item.status === 'planned').length;
            const todayWorkouts = workouts.filter(item => item.date === today);
            const streak = (() => {
                let count = 0;
                const doneDates = new Set(
                    workouts.filter(item => item.status === 'done').map(item => item.date)
                );
                const cursor = new Date(`${today}T00:00:00`);
                // 若今天还没练，从昨天开始算连续
                if (!doneDates.has(today)) cursor.setDate(cursor.getDate() - 1);
                while (true) {
                    const key = cursor.toISOString().slice(0, 10);
                    if (!doneDates.has(key)) break;
                    count += 1;
                    cursor.setDate(cursor.getDate() - 1);
                    if (count > 365) break;
                }
                return count;
            })();
            return {
                total: workouts.length,
                recentCount: recent.length,
                doneCount,
                plannedCount,
                todayCount: todayWorkouts.length,
                todayDoneCount: todayWorkouts.filter(item => item.status === 'done').length,
                streak,
                latest: workouts[0] || null,
                latestDone: workouts.find(item => item.status === 'done') || null
            };
        }

        function suggestTodayPlanDay(plans = [], dateStr = getTodayStr()) {
            const weekday = new Date(`${dateStr}T00:00:00`).getDay();
            const activePlans = getActiveFitnessPlans(plans);
            for (const plan of activePlans) {
                if ((plan.weekdays || []).includes(weekday) && (plan.days || []).length) {
                    const dayIndex = Math.max(0, (plan.weekdays || []).indexOf(weekday));
                    const day = plan.days[dayIndex % plan.days.length] || plan.days[0];
                    return { plan, day, weekday };
                }
            }
            if (activePlans[0]?.days?.length) {
                return { plan: activePlans[0], day: activePlans[0].days[0], weekday };
            }
            return null;
        }

        function buildFitnessOverview({ bodyMetrics = [], fitnessPlans = [], fitnessWorkouts = [] } = {}) {
            const metricSummary = buildBodyMetricSummary(bodyMetrics);
            const workoutSummary = buildWorkoutSummary(fitnessWorkouts, 30);
            const plans = normalizeFitnessPlans(fitnessPlans);
            const activePlans = plans.filter(item => item.status === 'active');
            const suggestion = suggestTodayPlanDay(plans);
            return {
                metricSummary,
                workoutSummary,
                planCount: plans.length,
                activePlanCount: activePlans.length,
                suggestion,
                latestMetric: metricSummary.latest,
                latestWorkout: workoutSummary.latest
            };
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
            PLAN_GOAL_OPTIONS,
            PLAN_STATUS_OPTIONS,
            WORKOUT_STATUS_OPTIONS,
            WEEKDAY_OPTIONS,
            parseMetricNumber,
            hasAnyMetric,
            normalizeBodyMetric,
            normalizeBodyMetrics,
            normalizeExercise,
            normalizePlanDay,
            normalizeFitnessPlan,
            normalizeFitnessPlans,
            normalizeWorkoutSet,
            normalizeWorkoutExercise,
            normalizeFitnessWorkout,
            normalizeFitnessWorkouts,
            normalizeFitnessData,
            formatMetricValue,
            formatSignedChange,
            getConditionLabel,
            getPlanGoalLabel,
            getPlanStatusLabel,
            getWeekdayLabels,
            countPlanExercises,
            getWorkoutStatusLabel,
            getWorkoutTitle,
            countCompletedSets,
            countTotalSets,
            getLatestBodyMetric,
            getMetricSeries,
            getMetricChange,
            buildBodyMetricSummary,
            buildWorkoutSummary,
            suggestTodayPlanDay,
            buildFitnessOverview,
            createBodyMetricDraft,
            validateBodyMetricInput,
            upsertBodyMetric,
            removeBodyMetric,
            findSameDayMetrics,
            createFitnessPlanDraft,
            validateFitnessPlanInput,
            upsertFitnessPlan,
            removeFitnessPlan,
            getActiveFitnessPlans,
            findFitnessPlan,
            createDefaultSets,
            createWorkoutFromPlanDay,
            createFitnessWorkoutDraft,
            validateFitnessWorkoutInput,
            upsertFitnessWorkout,
            removeFitnessWorkout,
            findFitnessWorkout
        };
    }

    window.LifePlanFitnessService = {
        create,
        METRIC_FIELDS,
        CONDITION_OPTIONS,
        PLAN_GOAL_OPTIONS,
        PLAN_STATUS_OPTIONS,
        WORKOUT_STATUS_OPTIONS,
        WEEKDAY_OPTIONS
    };
})();
