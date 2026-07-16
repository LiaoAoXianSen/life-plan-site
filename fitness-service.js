(function () {
    const METRIC_FIELDS = [
        { key: 'weight', label: '体重', unit: 'kg', step: '0.1' },
        { key: 'bodyFat', label: '体脂', unit: '%', step: '0.1' },
        { key: 'chest', label: '胸围', unit: 'cm', step: '0.1' },
        { key: 'waist', label: '腰围', unit: 'cm', step: '0.1' },
        { key: 'hips', label: '臀围', unit: 'cm', step: '0.1' },
        { key: 'arm', label: '臂围', unit: 'cm', step: '0.1' },
        { key: 'thigh', label: '大腿围', unit: 'cm', step: '0.1' },
        { key: 'calf', label: '小腿围', unit: 'cm', step: '0.1' },
        { key: 'shoulder', label: '肩围', unit: 'cm', step: '0.1' },
        { key: 'height', label: '身高', unit: 'cm', step: '0.1' }
    ];

    const LEGACY_METRIC_ALIASES = {
        arm: ['leftArm', 'rightArm', 'arm'],
        thigh: ['leftThigh', 'rightThigh', 'thigh']
    };

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
        { value: 'inProgress', label: '训练中' },
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

    const EXERCISE_MUSCLE_OPTIONS = [
        { value: 'chest', label: '胸' },
        { value: 'back', label: '背' },
        { value: 'shoulder', label: '肩' },
        { value: 'arm', label: '手臂' },
        { value: 'leg', label: '腿' },
        { value: 'core', label: '核心' },
        { value: 'cardio', label: '有氧' },
        { value: 'other', label: '其他' }
    ];

    const DEFAULT_REST_SEC = 90;

    const DEFAULT_EXERCISE_LIBRARY = [
        { name: '杠铃深蹲', muscle: 'leg', defaultSets: 4, defaultReps: '5-8', restSec: 150 },
        { name: '腿举', muscle: 'leg', defaultSets: 3, defaultReps: '8-12', restSec: 120 },
        { name: '罗马尼亚硬拉', muscle: 'leg', defaultSets: 3, defaultReps: '8-10', restSec: 120 },
        { name: '杠铃卧推', muscle: 'chest', defaultSets: 4, defaultReps: '5-8', restSec: 150 },
        { name: '哑铃卧推', muscle: 'chest', defaultSets: 3, defaultReps: '8-12', restSec: 90 },
        { name: '俯卧撑', muscle: 'chest', defaultSets: 3, defaultReps: '10-15', restSec: 60 },
        { name: '引体向上', muscle: 'back', defaultSets: 4, defaultReps: '6-10', restSec: 120 },
        { name: '杠铃划船', muscle: 'back', defaultSets: 4, defaultReps: '6-10', restSec: 120 },
        { name: '高位下拉', muscle: 'back', defaultSets: 3, defaultReps: '8-12', restSec: 90 },
        { name: '哑铃肩推', muscle: 'shoulder', defaultSets: 3, defaultReps: '8-12', restSec: 90 },
        { name: '侧平举', muscle: 'shoulder', defaultSets: 3, defaultReps: '12-15', restSec: 60 },
        { name: '杠铃弯举', muscle: 'arm', defaultSets: 3, defaultReps: '8-12', restSec: 60 },
        { name: '绳索下压', muscle: 'arm', defaultSets: 3, defaultReps: '10-15', restSec: 60 },
        { name: '卷腹', muscle: 'core', defaultSets: 3, defaultReps: '15-20', restSec: 45 },
        { name: '平板支撑', muscle: 'core', defaultSets: 3, defaultReps: '30-60s', restSec: 45 },
        { name: '跑步机', muscle: 'cardio', defaultSets: 1, defaultReps: '20-30min', restSec: 0 }
    ];

    function create(options = {}) {
        const {
            getTodayStr = () => {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            },
            getNowLocal = () => new Date().toISOString(),
            genId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
        } = options;

        function toLocalDateKey(date = new Date()) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        function shiftLocalDateKey(dateStr = getTodayStr(), days = 0) {
            const base = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
            if (Number.isNaN(base.getTime())) return String(dateStr || '').slice(0, 10);
            base.setDate(base.getDate() + days);
            return toLocalDateKey(base);
        }

        function parseMetricNumber(value) {
            if (value === '' || value === null || value === undefined) return null;
            const num = Number(value);
            return Number.isFinite(num) ? Math.round(num * 10) / 10 : null;
        }

        function hasAnyMetric(metric = {}) {
            return METRIC_FIELDS.some(field => parseMetricNumber(metric[field.key]) !== null);
        }

        function pickMetricValue(raw = {}, fallback = {}, key = '') {
            const aliases = LEGACY_METRIC_ALIASES[key] || [key];
            const values = [];
            aliases.forEach(alias => {
                const fromRaw = parseMetricNumber(raw[alias]);
                if (fromRaw !== null) values.push(fromRaw);
            });
            if (!values.length) {
                aliases.forEach(alias => {
                    const fromFallback = parseMetricNumber(fallback[alias]);
                    if (fromFallback !== null) values.push(fromFallback);
                });
            }
            if (!values.length) return null;
            // Old left/right pairs collapse to one number (prefer larger side).
            return Math.max(...values);
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
                const value = pickMetricValue(raw, fallback, field.key);
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
                name: String(raw.name ?? fallback.name ?? `训练 ${index + 1}`).trim() || `训练 ${index + 1}`,
                exercises
            };
        }

        function collectPlanExercises(raw = {}, fallback = {}) {
            const topLevel = Array.isArray(raw.exercises)
                ? raw.exercises
                : (Array.isArray(fallback.exercises) ? fallback.exercises : null);
            if (topLevel) {
                return topLevel.map(item => normalizeExercise(item)).filter(item => item.name);
            }
            const daysSource = Array.isArray(raw.days) ? raw.days : (fallback.days || []);
            return daysSource
                .flatMap(day => (Array.isArray(day?.exercises) ? day.exercises : []))
                .map(item => normalizeExercise(item))
                .filter(item => item.name);
        }

        function getPlanExercises(plan = {}) {
            if (Array.isArray(plan.exercises) && plan.exercises.length) {
                return plan.exercises.map(item => normalizeExercise(item)).filter(item => item.name);
            }
            return (plan.days || [])
                .flatMap(day => day.exercises || [])
                .map(item => normalizeExercise(item))
                .filter(item => item.name);
        }

        function normalizeFitnessPlan(raw = {}, fallback = {}) {
            const createdAt = raw.createdAt || fallback.createdAt || getNowLocal();
            const name = String(raw.name ?? fallback.name ?? '').trim();
            const exercises = collectPlanExercises(raw, fallback);
            const dayId = (Array.isArray(raw.days) && raw.days[0]?.id)
                || (Array.isArray(fallback.days) && fallback.days[0]?.id)
                || genId();
            // Plans are now a named exercise list. Keep a single mirrored day for older data/workouts.
            const days = exercises.length
                ? [{ id: dayId, name: name || '训练', exercises }]
                : [];
            const goal = PLAN_GOAL_OPTIONS.some(item => item.value === raw.goal)
                ? raw.goal
                : (PLAN_GOAL_OPTIONS.some(item => item.value === fallback.goal) ? fallback.goal : 'general');
            const status = PLAN_STATUS_OPTIONS.some(item => item.value === raw.status)
                ? raw.status
                : (PLAN_STATUS_OPTIONS.some(item => item.value === fallback.status) ? fallback.status : 'active');
            return {
                id: raw.id || fallback.id || genId(),
                name,
                goal,
                status,
                weekdays: [],
                notes: typeof (raw.notes ?? fallback.notes) === 'string' ? String(raw.notes ?? fallback.notes) : '',
                exercises,
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
            const workout = {
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
            const startedAt = String(raw.startedAt || fallback.startedAt || '').trim();
            const finishedAt = String(raw.finishedAt || fallback.finishedAt || '').trim();
            if (startedAt) workout.startedAt = startedAt;
            if (finishedAt) workout.finishedAt = finishedAt;
            return workout;
        }

        function normalizeFitnessWorkouts(list = []) {
            return (Array.isArray(list) ? list : [])
                .map(item => normalizeFitnessWorkout(item))
                .filter(item => item.id && item.date && (item.title || item.exercises.length))
                .sort((a, b) => {
                    const statusRank = (status) => (status === 'inProgress' ? 0 : 1);
                    const rankDiff = statusRank(a.status) - statusRank(b.status);
                    if (rankDiff) return rankDiff;
                    const dateDiff = String(b.date || '').localeCompare(String(a.date || ''));
                    if (dateDiff) return dateDiff;
                    return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
                });
        }

        function getMuscleLabel(value = 'other') {
            return EXERCISE_MUSCLE_OPTIONS.find(item => item.value === value)?.label || '其他';
        }

        function normalizeExerciseLibraryItem(raw = {}, fallback = {}) {
            const createdAt = raw.createdAt || fallback.createdAt || getNowLocal();
            const name = String(raw.name ?? fallback.name ?? '').trim();
            const muscle = EXERCISE_MUSCLE_OPTIONS.some(item => item.value === raw.muscle)
                ? raw.muscle
                : (EXERCISE_MUSCLE_OPTIONS.some(item => item.value === fallback.muscle) ? fallback.muscle : 'other');
            const item = {
                id: raw.id || fallback.id || genId(),
                name,
                muscle,
                defaultSets: parsePositiveInt(raw.defaultSets ?? fallback.defaultSets, 3) || 3,
                defaultReps: String(raw.defaultReps ?? fallback.defaultReps ?? '8-12').trim() || '8-12',
                restSec: parsePositiveInt(raw.restSec ?? fallback.restSec, DEFAULT_REST_SEC) ?? DEFAULT_REST_SEC,
                note: typeof (raw.note ?? fallback.note) === 'string' ? String(raw.note ?? fallback.note) : '',
                createdAt,
                updatedAt: raw.updatedAt || fallback.updatedAt || createdAt
            };
            const defaultWeight = parseNonNegativeNumber(raw.defaultWeight ?? fallback.defaultWeight, null);
            if (defaultWeight !== null) item.defaultWeight = defaultWeight;
            return item;
        }

        function normalizeExerciseLibrary(list = []) {
            return (Array.isArray(list) ? list : [])
                .map(item => normalizeExerciseLibraryItem(item))
                .filter(item => item.id && item.name)
                .sort((a, b) => {
                    const muscleDiff = String(a.muscle || '').localeCompare(String(b.muscle || ''));
                    if (muscleDiff) return muscleDiff;
                    return String(a.name || '').localeCompare(String(b.name || ''), 'zh');
                });
        }

        function createDefaultExerciseLibrary() {
            return normalizeExerciseLibrary(DEFAULT_EXERCISE_LIBRARY.map(item => ({
                ...item,
                id: genId(),
                createdAt: getNowLocal(),
                updatedAt: getNowLocal()
            })));
        }

        function ensureExerciseLibrary(list = [], workouts = []) {
            let library = normalizeExerciseLibrary(list);
            if (!library.length) library = createDefaultExerciseLibrary();
            const known = new Set(library.map(item => item.name.toLowerCase()));
            (Array.isArray(workouts) ? workouts : []).forEach(workout => {
                (workout.exercises || []).forEach(exercise => {
                    const name = String(exercise?.name || '').trim();
                    if (!name || known.has(name.toLowerCase())) return;
                    known.add(name.toLowerCase());
                    library.push(normalizeExerciseLibraryItem({
                        name,
                        muscle: 'other',
                        defaultSets: exercise.targetSets || (exercise.sets || []).length || 3,
                        defaultReps: exercise.targetReps || '8-12',
                        defaultWeight: exercise.targetWeight,
                        restSec: DEFAULT_REST_SEC
                    }));
                });
            });
            return normalizeExerciseLibrary(library);
        }

        function findExerciseLibraryItem(list = [], exerciseId = '') {
            return normalizeExerciseLibrary(list).find(item => item.id === exerciseId) || null;
        }

        function findExerciseLibraryByName(list = [], name = '') {
            const key = String(name || '').trim().toLowerCase();
            if (!key) return null;
            return normalizeExerciseLibrary(list).find(item => item.name.toLowerCase() === key) || null;
        }

        function upsertExerciseLibraryItem(list = [], input = {}, existingId = '') {
            const item = normalizeExerciseLibraryItem(input);
            if (!item.name) return { ok: false, message: '请填写动作名称', library: normalizeExerciseLibrary(list) };
            const library = normalizeExerciseLibrary(list);
            const stamp = getNowLocal();
            const duplicate = library.find(entry => entry.name.toLowerCase() === item.name.toLowerCase() && entry.id !== existingId);
            if (duplicate) return { ok: false, message: '动作库里已有同名动作', library };
            if (existingId) {
                const index = library.findIndex(entry => entry.id === existingId);
                if (index >= 0) {
                    library[index] = normalizeExerciseLibraryItem({
                        ...library[index],
                        ...item,
                        id: existingId,
                        createdAt: library[index].createdAt,
                        updatedAt: stamp
                    });
                    return { ok: true, message: '', library: normalizeExerciseLibrary(library), item: library[index] };
                }
            }
            const created = normalizeExerciseLibraryItem({
                ...item,
                id: genId(),
                createdAt: stamp,
                updatedAt: stamp
            });
            return { ok: true, message: '', library: normalizeExerciseLibrary([created, ...library]), item: created };
        }

        function removeExerciseLibraryItem(list = [], exerciseId = '') {
            return normalizeExerciseLibrary(list).filter(item => item.id !== exerciseId);
        }

        function createWorkoutExerciseFromLibrary(item = {}, overrides = {}) {
            const source = normalizeExerciseLibraryItem(item);
            return normalizeWorkoutExercise({
                name: source.name,
                targetSets: source.defaultSets,
                targetReps: source.defaultReps,
                targetWeight: source.defaultWeight,
                note: source.note,
                sets: createDefaultSets(source.defaultSets, {
                    targetWeight: source.defaultWeight,
                    targetReps: source.defaultReps
                }),
                ...overrides
            });
        }

        function findLastExercisePerformance(workouts = [], exerciseName = '', excludeWorkoutId = '') {
            const key = String(exerciseName || '').trim().toLowerCase();
            if (!key) return null;
            const ordered = normalizeFitnessWorkouts(workouts)
                .filter(item => item.id !== excludeWorkoutId && item.status === 'done');
            for (const workout of ordered) {
                const exercise = (workout.exercises || []).find(item => String(item.name || '').trim().toLowerCase() === key);
                if (!exercise) continue;
                const doneSets = (exercise.sets || []).filter(set => set.done && (set.weight !== null || set.reps !== null));
                const bestSet = doneSets[doneSets.length - 1] || (exercise.sets || []).find(set => set.weight !== null || set.reps !== null) || null;
                if (!bestSet && !exercise.targetWeight && !exercise.targetReps) continue;
                return {
                    workoutId: workout.id,
                    workoutDate: workout.date,
                    workoutTitle: getWorkoutTitle(workout),
                    exerciseName: exercise.name,
                    targetWeight: exercise.targetWeight ?? null,
                    targetReps: exercise.targetReps || '',
                    set: bestSet ? normalizeWorkoutSet(bestSet) : null,
                    doneSets: doneSets.map(set => normalizeWorkoutSet(set))
                };
            }
            return null;
        }

        function getPreviousSetInExercise(exercise = {}, setIndex = 0) {
            const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
            for (let i = setIndex - 1; i >= 0; i -= 1) {
                const set = sets[i];
                if (set && (set.weight !== null || set.reps !== null || set.done)) {
                    return normalizeWorkoutSet(set);
                }
            }
            return null;
        }

        function suggestSetValues(exercise = {}, setIndex = 0, history = null) {
            const previous = getPreviousSetInExercise(exercise, setIndex);
            if (previous && (previous.weight !== null || previous.reps !== null)) {
                return {
                    source: 'previousSet',
                    weight: previous.weight,
                    reps: previous.reps,
                    label: `复制上一组 ${previous.weight ?? '—'}kg × ${previous.reps ?? '—'}`
                };
            }
            if (history?.set && (history.set.weight !== null || history.set.reps !== null)) {
                return {
                    source: 'history',
                    weight: history.set.weight,
                    reps: history.set.reps,
                    label: `上次 ${history.workoutDate} ${history.set.weight ?? '—'}kg × ${history.set.reps ?? '—'}`
                };
            }
            if (exercise?.targetWeight !== null && exercise?.targetWeight !== undefined) {
                const reps = parsePositiveInt(String(exercise.targetReps || '').split(/[-~/]/)[0], null);
                return {
                    source: 'target',
                    weight: exercise.targetWeight,
                    reps,
                    label: `目标 ${exercise.targetWeight}kg${exercise.targetReps ? ` × ${exercise.targetReps}` : ''}`
                };
            }
            return null;
        }

        function applySuggestionToSet(set = {}, suggestion = null) {
            if (!suggestion) return normalizeWorkoutSet(set);
            return normalizeWorkoutSet({
                ...set,
                weight: set.weight === null || set.weight === undefined || set.weight === ''
                    ? suggestion.weight
                    : set.weight,
                reps: set.reps === null || set.reps === undefined || set.reps === ''
                    ? suggestion.reps
                    : set.reps
            });
        }

        function getExerciseRestSec(exercise = {}, library = []) {
            const match = findExerciseLibraryByName(library, exercise?.name || '');
            if (match && Number.isFinite(match.restSec)) return match.restSec;
            return DEFAULT_REST_SEC;
        }

        function computeDurationMin(startedAt = '', finishedAt = '') {
            const start = Date.parse(startedAt);
            const end = Date.parse(finishedAt || getNowLocal());
            if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
            return Math.max(1, Math.round((end - start) / 60000));
        }

        function startLiveWorkout(input = {}) {
            const stamp = getNowLocal();
            return normalizeFitnessWorkout({
                ...input,
                status: 'inProgress',
                startedAt: input.startedAt || stamp,
                finishedAt: '',
                date: input.date || getTodayStr(),
                updatedAt: stamp
            });
        }

        function completeWorkoutSet(workout = {}, exerciseIndex = 0, setIndex = 0, options = {}) {
            const next = normalizeFitnessWorkout(JSON.parse(JSON.stringify(workout || {})));
            const exercise = next.exercises?.[exerciseIndex];
            if (!exercise?.sets?.[setIndex]) {
                return { ok: false, message: '找不到对应组', workout: next };
            }
            const history = options.history || null;
            let set = normalizeWorkoutSet(exercise.sets[setIndex]);
            if (options.autoFill !== false) {
                const suggestion = suggestSetValues(exercise, setIndex, history);
                set = applySuggestionToSet(set, suggestion);
            }
            if (options.weight !== undefined) set.weight = parseNonNegativeNumber(options.weight, set.weight);
            if (options.reps !== undefined) set.reps = parsePositiveInt(options.reps, set.reps);
            set.done = options.done === false ? false : true;
            exercise.sets[setIndex] = set;
            if (!next.startedAt) next.startedAt = getNowLocal();
            if (next.status === 'planned') next.status = 'inProgress';
            next.updatedAt = getNowLocal();
            return {
                ok: true,
                message: '',
                workout: normalizeFitnessWorkout(next),
                restSec: getExerciseRestSec(exercise, options.library || [])
            };
        }

        function finishLiveWorkout(workout = {}, overrides = {}) {
            const stamp = getNowLocal();
            const startedAt = workout.startedAt || stamp;
            const finishedAt = overrides.finishedAt || stamp;
            const durationMin = overrides.durationMin !== undefined
                ? parsePositiveInt(overrides.durationMin, null)
                : (workout.durationMin || computeDurationMin(startedAt, finishedAt));
            return normalizeFitnessWorkout({
                ...workout,
                ...overrides,
                status: overrides.status || 'done',
                startedAt,
                finishedAt,
                durationMin,
                updatedAt: stamp
            });
        }

        function findActiveWorkout(list = []) {
            return normalizeFitnessWorkouts(list).find(item => item.status === 'inProgress') || null;
        }

        function normalizeFitnessData(target = {}) {
            if (!target || typeof target !== 'object') return target;
            if (!Array.isArray(target.bodyMetrics)) target.bodyMetrics = [];
            if (!Array.isArray(target.fitnessPlans)) target.fitnessPlans = [];
            if (!Array.isArray(target.fitnessWorkouts)) target.fitnessWorkouts = [];
            if (!Array.isArray(target.exerciseLibrary)) target.exerciseLibrary = [];
            target.bodyMetrics = normalizeBodyMetrics(target.bodyMetrics);
            target.fitnessPlans = normalizeFitnessPlans(target.fitnessPlans);
            target.fitnessWorkouts = normalizeFitnessWorkouts(target.fitnessWorkouts);
            // Keep empty library empty during normalize so load/sync does not auto-dirty data.
            // Defaults are seeded only when the fitness UI asks for a usable library.
            target.exerciseLibrary = normalizeExerciseLibrary(target.exerciseLibrary);
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
            return getPlanExercises(plan).length;
        }

        function createFitnessPlanDraft(overrides = {}) {
            const stamp = getNowLocal();
            const dayId = genId();
            // Keep empty exercise placeholders for the editor; full normalize would strip them.
            const exercises = [
                {
                    id: genId(),
                    name: '',
                    targetSets: 3,
                    targetReps: '8-12'
                }
            ];
            return {
                id: genId(),
                name: '',
                goal: 'general',
                status: 'active',
                weekdays: [],
                notes: '',
                exercises,
                days: [
                    {
                        id: dayId,
                        name: '训练',
                        exercises
                    }
                ],
                createdAt: stamp,
                updatedAt: stamp,
                ...overrides
            };
        }

        function validateFitnessPlanInput(input = {}) {
            const plan = normalizeFitnessPlan(input);
            if (!plan.name) return { ok: false, message: '请填写计划名称', plan };
            if (!plan.exercises.length) return { ok: false, message: '请至少添加一个动作', plan };
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

        function createWorkoutFromPlan(plan = {}, overrides = {}) {
            const sourcePlan = normalizeFitnessPlan(plan);
            const exercises = getPlanExercises(sourcePlan);
            const day = sourcePlan.days?.[0] || null;
            return normalizeFitnessWorkout({
                date: getTodayStr(),
                status: 'planned',
                planId: sourcePlan.id || '',
                planName: sourcePlan.name || '',
                dayId: day?.id || '',
                dayName: '',
                title: sourcePlan.name || '今日训练',
                notes: '',
                exercises: exercises.map(exercise => normalizeWorkoutExercise({
                    name: exercise.name,
                    targetSets: exercise.targetSets,
                    targetReps: exercise.targetReps,
                    targetWeight: exercise.targetWeight,
                    note: exercise.note,
                    restSec: exercise.restSec,
                    sets: createDefaultSets(exercise.targetSets, exercise)
                })),
                ...overrides
            });
        }

        function createWorkoutFromPlanDay(plan = {}, day = {}, overrides = {}) {
            // Backward-compatible wrapper: plans no longer use multi-day structure.
            if (day && Array.isArray(day.exercises) && day.exercises.length) {
                return createWorkoutFromPlan({
                    ...plan,
                    exercises: day.exercises,
                    days: [day]
                }, overrides);
            }
            return createWorkoutFromPlan(plan, overrides);
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
            const thresholdDate = shiftLocalDateKey(today, -days);
            const recent = workouts.filter(item => item.date >= thresholdDate);
            const doneCount = recent.filter(item => item.status === 'done').length;
            const plannedCount = recent.filter(item => item.status === 'planned').length;
            const todayWorkouts = workouts.filter(item => item.date === today);
            const streak = (() => {
                let count = 0;
                const doneDates = new Set(
                    workouts.filter(item => item.status === 'done').map(item => item.date)
                );
                let cursor = today;
                // 若今天还没练，从昨天开始算连续
                if (!doneDates.has(today)) cursor = shiftLocalDateKey(today, -1);
                while (doneDates.has(cursor)) {
                    count += 1;
                    cursor = shiftLocalDateKey(cursor, -1);
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

        function suggestTodayPlan(plans = [], dateStr = getTodayStr()) {
            const weekday = new Date(`${dateStr}T00:00:00`).getDay();
            const activePlans = getActiveFitnessPlans(plans).filter(plan => getPlanExercises(plan).length);
            if (!activePlans.length) return null;
            return { plan: activePlans[0], day: activePlans[0].days?.[0] || null, weekday };
        }

        function suggestTodayPlanDay(plans = [], dateStr = getTodayStr()) {
            return suggestTodayPlan(plans, dateStr);
        }

        function buildFitnessOverview({ bodyMetrics = [], fitnessPlans = [], fitnessWorkouts = [] } = {}) {
            const metricSummary = buildBodyMetricSummary(bodyMetrics);
            const workoutSummary = buildWorkoutSummary(fitnessWorkouts, 30);
            const plans = normalizeFitnessPlans(fitnessPlans);
            const activePlans = plans.filter(item => item.status === 'active');
            const suggestion = suggestTodayPlan(plans);
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
            const threshold = shiftLocalDateKey(latest.date, -days);
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
            EXERCISE_MUSCLE_OPTIONS,
            DEFAULT_REST_SEC,
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
            normalizeExerciseLibraryItem,
            normalizeExerciseLibrary,
            createDefaultExerciseLibrary,
            ensureExerciseLibrary,
            findExerciseLibraryItem,
            findExerciseLibraryByName,
            upsertExerciseLibraryItem,
            removeExerciseLibraryItem,
            createWorkoutExerciseFromLibrary,
            findLastExercisePerformance,
            getPreviousSetInExercise,
            suggestSetValues,
            applySuggestionToSet,
            getExerciseRestSec,
            computeDurationMin,
            startLiveWorkout,
            completeWorkoutSet,
            finishLiveWorkout,
            findActiveWorkout,
            normalizeFitnessData,
            formatMetricValue,
            formatSignedChange,
            getConditionLabel,
            getPlanGoalLabel,
            getPlanStatusLabel,
            getWeekdayLabels,
            getMuscleLabel,
            countPlanExercises,
            getPlanExercises,
            getWorkoutStatusLabel,
            getWorkoutTitle,
            countCompletedSets,
            countTotalSets,
            getLatestBodyMetric,
            getMetricSeries,
            getMetricChange,
            buildBodyMetricSummary,
            buildWorkoutSummary,
            suggestTodayPlan,
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
            createWorkoutFromPlan,
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
        WEEKDAY_OPTIONS,
        EXERCISE_MUSCLE_OPTIONS,
        DEFAULT_REST_SEC
    };
})();
