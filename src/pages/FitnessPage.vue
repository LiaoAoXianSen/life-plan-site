<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue';

import { getTodayStr } from '../services/legacyServices';
import { useFitnessStore } from '../stores/fitnessStore';

type PlanSetDraft = { id?: string; weight?: unknown; reps?: unknown };
type PlanExerciseDraft = {
  localId: string;
  name: string;
  note: string;
  restSec?: unknown;
  targetSets?: unknown;
  targetReps?: unknown;
  targetWeight?: unknown;
  plannedSets?: PlanSetDraft[];
  sets: PlanSetDraft[];
};
type WorkoutSetDraft = PlanSetDraft & { done?: boolean };
type WorkoutExerciseDraft = Omit<PlanExerciseDraft, 'sets'> & { sets: WorkoutSetDraft[] };

const fitness = useFitnessStore();
const metricForm = reactive({
  id: '',
  date: getTodayStr(),
  condition: 'fasted',
  note: '',
  values: {
    weight: '',
    bodyFat: '',
    chest: '',
    waist: '',
    hips: '',
    arm: '',
    thigh: '',
    calf: '',
    shoulder: '',
    height: '',
  } as Record<string, string>,
});
const libraryForm = reactive({ name: '', muscle: 'other', defaultSets: 3, defaultReps: '8-12', defaultWeight: '', restSec: 90, note: '' });
const planForm = reactive({ name: '', goal: 'general', status: 'active', notes: '', exercises: [] as PlanExerciseDraft[] });
const workoutForm = reactive({ date: getTodayStr(), status: 'done', title: '', planId: '', durationMin: '', notes: '', exercises: [] as WorkoutExerciseDraft[] });
const freeForm = reactive({ title: '自由训练', exerciseId: '' });
const formError = ref('');
const planEditingId = ref('');
const workoutEditingId = ref('');
const writeBackPlan = ref(false);
const restTimer = reactive({ remaining: 0, total: 0, exerciseName: '' });
let restTimerId: ReturnType<typeof window.setInterval> | null = null;

const doneHistory = computed(() => fitness.workouts.filter(item => item.status === 'done' || item.status === 'skipped'));
const recentWorkoutCount = computed(() => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const key = getTodayStr(cutoff);
  return doneHistory.value.filter(item => String(item.date || item.createdAt || '').slice(0, 10) >= key).length;
});
const activePlanCount = computed(() => fitness.plans.filter(plan => String(plan.status || 'active') === 'active').length);
const latestMetric = computed(() => fitness.metrics[0] || null);
const latestWeight = computed(() => {
  const metric = latestMetric.value as Record<string, any> | null;
  if (!metric) return '—';
  const parsed = fitness.services.fitness.parseMetricNumber(metric.weight);
  if (parsed === null) return '—';
  return fitness.services.fitness.formatMetricValue(metric.weight, 'kg');
});
const overviewKpis = computed(() => [
  { label: '当前体重', value: latestWeight.value, hint: latestMetric.value ? String((latestMetric.value as any).date || '') : '还没有身材记录' },
  { label: '近 30 天训练', value: String(recentWorkoutCount.value), hint: '已完成 / 跳过' },
  { label: '进行中计划', value: String(activePlanCount.value), hint: `全部计划 ${fitness.plans.length}` },
  { label: '动作库', value: String(fitness.library.length), hint: '可用于自由训练' },
]);

function jumpToFreeWorkout() {
  if (!fitness.library.length) {
    run(() => fitness.ensureLibrary());
  }
  if (!freeForm.exerciseId && fitness.library[0]) freeForm.exerciseId = String(fitness.library[0].id || '');
  if (!freeForm.title) freeForm.title = '自由训练';
  if (fitness.library.length) {
    startFreeWorkout();
    return;
  }
  const el = document.getElementById('fitness-library-section');
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openLibrarySection() {
  if (!fitness.library.length) seedLibrary();
  const el = document.getElementById('fitness-library-section');
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openPlanCreate() {
  resetPlanForm();
  const el = document.getElementById('fitness-plan-section');
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openWorkoutCreate() {
  resetWorkoutForm();
  const el = document.getElementById('fitness-workout-section');
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openBodySection() {
  resetMetricForm();
  const el = document.getElementById('fitness-body-section');
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const activeCompleted = computed(() => fitness.activeWorkout ? fitness.services.fitness.countCompletedSets(fitness.activeWorkout) : 0);
const activeTotal = computed(() => fitness.activeWorkout ? fitness.services.fitness.countTotalSets(fitness.activeWorkout) : 0);
const activePlan = computed(() => fitness.activeWorkout?.planId ? fitness.services.fitness.findFitnessPlan(fitness.plans, fitness.activeWorkout.planId) : null);
const activePlanDiff = computed(() => activePlan.value && fitness.activeWorkout
  ? fitness.services.fitness.hasPlanPrescriptionDiff(activePlan.value, fitness.activeWorkout)
  : false);
const muscleOptions = computed(() => fitness.services.fitness.EXERCISE_MUSCLE_OPTIONS);
const goalOptions = computed(() => fitness.services.fitness.PLAN_GOAL_OPTIONS);
const planStatusOptions = computed(() => fitness.services.fitness.PLAN_STATUS_OPTIONS);
const workoutStatusOptions = computed(() => fitness.services.fitness.WORKOUT_STATUS_OPTIONS.filter((option: Record<string, string>) => option.value !== 'inProgress'));
const metricFields = computed(() => fitness.services.fitness.METRIC_FIELDS);
const conditionOptions = computed(() => fitness.services.fitness.CONDITION_OPTIONS);

function localDraftId() {
  return `plan-draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function run(action: () => unknown) {
  try {
    action();
    formError.value = '';
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  }
}

function seedLibrary() {
  run(() => {
    fitness.ensureLibrary();
    if (!freeForm.exerciseId && fitness.library[0]) freeForm.exerciseId = fitness.library[0].id;
    if (fitness.library[0] && planForm.exercises.length === 1 && !planForm.exercises[0].name) {
      applyLibraryToPlanExercise(0, fitness.library[0].id);
    }
  });
}

function createPlanSet(template: Record<string, unknown> = {}): PlanSetDraft {
  return fitness.services.fitness.normalizePlanSet(template) as PlanSetDraft;
}

function createBlankPlanExercise(): PlanExerciseDraft {
  return {
    localId: localDraftId(),
    name: '',
    note: '',
    sets: fitness.services.fitness.createPlanSets(3, { targetReps: '8-12' }) as PlanSetDraft[],
  };
}

function createPlanExerciseFromLibrary(item: Record<string, any>): PlanExerciseDraft {
  return {
    localId: localDraftId(),
    name: String(item.name || ''),
    note: String(item.note || ''),
    restSec: item.restSec,
    sets: fitness.services.fitness.createPlanSets(item.defaultSets || 3, {
      targetReps: item.defaultReps || '8-12',
      targetWeight: item.defaultWeight,
    }) as PlanSetDraft[],
  };
}

function toWorkoutSet(set: Record<string, unknown> = {}, done = false): WorkoutSetDraft {
  return fitness.services.fitness.normalizeWorkoutSet({ ...set, done }) as WorkoutSetDraft;
}

function createWorkoutExerciseDraft(source: Record<string, any> = {}): WorkoutExerciseDraft {
  const normalized = fitness.services.fitness.normalizeWorkoutExercise({
    name: source.name || '',
    targetSets: source.targetSets || 3,
    targetReps: source.targetReps || '8-12',
    targetWeight: source.targetWeight,
    note: source.note || '',
    restSec: source.restSec,
    plannedSets: source.plannedSets,
    sets: Array.isArray(source.sets) && source.sets.length ? source.sets : fitness.services.fitness.createDefaultSets(source.targetSets || 3, source),
  }) as Record<string, any>;
  return {
    localId: localDraftId(),
    name: String(normalized.name || ''),
    note: String(normalized.note || ''),
    restSec: normalized.restSec,
    targetSets: normalized.targetSets,
    targetReps: normalized.targetReps,
    targetWeight: normalized.targetWeight,
    plannedSets: normalized.plannedSets,
    sets: (normalized.sets || []).map((set: Record<string, unknown>) => toWorkoutSet(set, set.done === true)),
  };
}

function createWorkoutExerciseFromLibrary(item: Record<string, any>): WorkoutExerciseDraft {
  return createWorkoutExerciseDraft(fitness.services.fitness.createWorkoutExerciseFromLibrary(item));
}

function resetPlanForm() {
  Object.assign(planForm, { name: '', goal: 'general', status: 'active', notes: '' });
  planForm.exercises.splice(0, planForm.exercises.length, createBlankPlanExercise());
  planEditingId.value = '';
}

function resetWorkoutForm() {
  Object.assign(workoutForm, { date: getTodayStr(), status: 'done', title: '', planId: '', durationMin: '', notes: '' });
  workoutForm.exercises.splice(0, workoutForm.exercises.length, createWorkoutExerciseDraft());
  workoutEditingId.value = '';
}

function resetMetricForm() {
  Object.assign(metricForm, { id: '', date: getTodayStr(), condition: 'fasted', note: '' });
  metricFields.value.forEach((field: Record<string, string>) => {
    metricForm.values[field.key] = '';
  });
}

function metricPayload() {
  const input: Record<string, unknown> = {
    date: metricForm.date,
    condition: metricForm.condition,
    note: metricForm.note,
  };
  metricFields.value.forEach((field: Record<string, string>) => {
    input[field.key] = metricForm.values[field.key];
  });
  return input;
}

function saveMetric() {
  run(() => {
    fitness.saveMetric(metricPayload(), metricForm.id);
    resetMetricForm();
  });
}

function editMetric(metric: Record<string, any>) {
  run(() => {
    Object.assign(metricForm, {
      id: metric.id || '',
      date: metric.date || getTodayStr(),
      condition: metric.condition || 'unknown',
      note: metric.note || '',
    });
    metricFields.value.forEach((field: Record<string, string>) => {
      const value = fitness.services.fitness.parseMetricNumber(metric[field.key]);
      metricForm.values[field.key] = value === null ? '' : String(value);
    });
  });
}

function metricChips(metric: Record<string, any>) {
  return metricFields.value
    .filter((field: Record<string, string>) => fitness.services.fitness.parseMetricNumber(metric[field.key]) !== null)
    .map((field: Record<string, string>) => ({
      key: field.key,
      label: field.label,
      value: fitness.services.fitness.formatMetricValue(metric[field.key], field.unit),
    }));
}

function saveLibraryItem() {
  run(() => {
    const item = fitness.saveLibraryItem({ ...libraryForm, defaultWeight: libraryForm.defaultWeight || undefined });
    Object.assign(libraryForm, { name: '', muscle: 'other', defaultSets: 3, defaultReps: '8-12', defaultWeight: '', restSec: 90, note: '' });
    if (!item) return;
    freeForm.exerciseId = item.id;
    if (planForm.exercises.length && !planForm.exercises[0].name) applyLibraryToPlanExercise(0, item.id);
  });
}

function savePlan() {
  run(() => {
    const exercises = planForm.exercises
      .map(exercise => fitness.services.fitness.normalizeExercise({
        name: exercise.name,
        note: exercise.note,
        restSec: exercise.restSec,
        targetSets: exercise.sets.length,
        sets: exercise.sets.map(set => fitness.services.fitness.normalizePlanSet(set)),
      }))
      .filter(exercise => String(exercise.name || '').trim());
    fitness.savePlan({
      name: planForm.name,
      goal: planForm.goal,
      status: planForm.status,
      notes: planForm.notes,
      weekdays: [],
      exercises,
    }, planEditingId.value);
    resetPlanForm();
  });
}

function startFreeWorkout() {
  run(() => fitness.startFreeWorkout(freeForm.exerciseId, freeForm.title));
}

function finishActiveWorkout() {
  run(() => {
    fitness.finishWorkout({ updatePlanFromWorkout: writeBackPlan.value && activePlanDiff.value === true });
    writeBackPlan.value = false;
    stopRestTimer();
  });
}

function editPlan(plan: Record<string, any>) {
  run(() => {
    const exercises = fitness.services.fitness.getPlanExercises(plan)
      .map((exercise: Record<string, any>) => ({
        localId: localDraftId(),
        name: String(exercise.name || ''),
        note: String(exercise.note || ''),
        restSec: exercise.restSec,
        sets: Array.isArray(exercise.sets) && exercise.sets.length
          ? exercise.sets.map((set: Record<string, unknown>) => createPlanSet(set))
          : fitness.services.fitness.createPlanSets(exercise.targetSets || 3, exercise),
      }));
    Object.assign(planForm, {
      name: plan.name || '',
      goal: plan.goal || 'general',
      status: plan.status || 'active',
      notes: plan.notes || '',
    });
    planForm.exercises.splice(0, planForm.exercises.length, ...(exercises.length ? exercises : [createBlankPlanExercise()]));
    planEditingId.value = plan.id || '';
  });
}

function applyPlanToWorkout(planId: string) {
  const plan = fitness.services.fitness.findFitnessPlan(fitness.plans, planId);
  workoutForm.planId = plan?.id || '';
  if (!plan) return;
  const generated = fitness.services.fitness.createWorkoutFromPlan(plan, {
    date: workoutForm.date,
    status: workoutForm.status,
    title: workoutForm.title || plan.name,
    durationMin: workoutForm.durationMin || undefined,
    notes: workoutForm.notes,
  });
  workoutForm.title = generated.title || plan.name || workoutForm.title;
  workoutForm.exercises.splice(0, workoutForm.exercises.length, ...generated.exercises.map((exercise: Record<string, any>) => createWorkoutExerciseDraft(exercise)));
}

function editWorkout(workout: Record<string, any>) {
  run(() => {
    Object.assign(workoutForm, {
      date: workout.date || getTodayStr(),
      status: workout.status || 'done',
      title: workout.title || '',
      planId: workout.planId || '',
      durationMin: workout.durationMin ?? '',
      notes: workout.notes || '',
    });
    workoutForm.exercises.splice(0, workoutForm.exercises.length, ...(workout.exercises || []).map((exercise: Record<string, any>) => createWorkoutExerciseDraft(exercise)));
    if (!workoutForm.exercises.length) workoutForm.exercises.push(createWorkoutExerciseDraft());
    workoutEditingId.value = workout.id || '';
  });
}

function applyLibraryToPlanExercise(index: number, exerciseId: string) {
  const item = fitness.library.find(entry => entry.id === exerciseId);
  if (!item || !planForm.exercises[index]) return;
  planForm.exercises.splice(index, 1, createPlanExerciseFromLibrary(item));
}

function applyLibraryToWorkoutExercise(index: number, exerciseId: string) {
  const item = fitness.library.find(entry => entry.id === exerciseId);
  if (!item || !workoutForm.exercises[index]) return;
  workoutForm.exercises.splice(index, 1, createWorkoutExerciseFromLibrary(item));
}

function addPlanExercise() {
  planForm.exercises.push(createBlankPlanExercise());
}

function removePlanExercise(index: number) {
  if (planForm.exercises.length <= 1) return;
  planForm.exercises.splice(index, 1);
}

function addPlanSet(exercise: PlanExerciseDraft) {
  const lastSet = exercise.sets[exercise.sets.length - 1] || {};
  exercise.sets.push(createPlanSet(lastSet as Record<string, unknown>));
}

function removePlanSet(exercise: PlanExerciseDraft, setIndex: number) {
  if (exercise.sets.length <= 1) return;
  exercise.sets.splice(setIndex, 1);
}

function addWorkoutExercise() {
  workoutForm.exercises.push(createWorkoutExerciseDraft());
}

function removeWorkoutExercise(index: number) {
  if (workoutForm.exercises.length <= 1) return;
  workoutForm.exercises.splice(index, 1);
}

function addWorkoutSet(exercise: WorkoutExerciseDraft) {
  const lastSet = exercise.sets[exercise.sets.length - 1] || {};
  exercise.sets.push(toWorkoutSet(lastSet as Record<string, unknown>, false));
}

function removeWorkoutSet(exercise: WorkoutExerciseDraft, setIndex: number) {
  if (exercise.sets.length <= 1) return;
  exercise.sets.splice(setIndex, 1);
}

function saveWorkoutLog() {
  run(() => {
    const plan = workoutForm.planId ? fitness.services.fitness.findFitnessPlan(fitness.plans, workoutForm.planId) : null;
    const exercises = workoutForm.exercises
      .map(exercise => fitness.services.fitness.normalizeWorkoutExercise({
        name: exercise.name,
        note: exercise.note,
        restSec: exercise.restSec,
        targetSets: exercise.sets.length,
        targetReps: exercise.targetReps,
        targetWeight: exercise.targetWeight,
        plannedSets: exercise.plannedSets,
        sets: exercise.sets.map(set => fitness.services.fitness.normalizeWorkoutSet(set)),
      }))
      .filter(exercise => String(exercise.name || '').trim());
    fitness.saveWorkout({
      date: workoutForm.date,
      status: workoutForm.status,
      title: workoutForm.title,
      durationMin: workoutForm.durationMin || undefined,
      notes: workoutForm.notes,
      planId: plan?.id || '',
      planName: plan?.name || '',
      dayId: plan?.days?.[0]?.id || '',
      dayName: '',
      exercises,
    }, workoutEditingId.value);
    resetWorkoutForm();
  });
}

function stopRestTimer() {
  if (restTimerId) window.clearInterval(restTimerId);
  restTimerId = null;
  Object.assign(restTimer, { remaining: 0, total: 0, exerciseName: '' });
}

function tickRestTimer() {
  restTimer.remaining = Math.max(0, restTimer.remaining - 1);
  if (restTimer.remaining <= 0 && restTimerId) {
    window.clearInterval(restTimerId);
    restTimerId = null;
  }
}

function startRestTimer(seconds: unknown, exerciseName = '') {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return;
  if (restTimerId) window.clearInterval(restTimerId);
  Object.assign(restTimer, { remaining: Math.round(total), total: Math.round(total), exerciseName });
  restTimerId = window.setInterval(tickRestTimer, 1000);
}

function adjustRestTimer(delta: number) {
  if (!restTimer.total && !restTimer.remaining) return;
  restTimer.remaining = Math.max(0, restTimer.remaining + delta);
  restTimer.total = Math.max(restTimer.total, restTimer.remaining);
  if (restTimer.remaining <= 0) stopRestTimer();
}

function formatClock(seconds: number) {
  const value = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(value / 60);
  const rest = String(value % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

function exerciseHistory(exercise: Record<string, any>) {
  return fitness.services.fitness.findLastExercisePerformance(
    fitness.workouts,
    exercise.name || '',
    fitness.activeWorkout?.id || '',
  );
}

function setSuggestion(exercise: Record<string, any>, setIndex: number) {
  if (exercise.sets?.[setIndex]?.done) return null;
  return fitness.services.fitness.suggestSetValues(exercise, setIndex, exerciseHistory(exercise));
}

function suggestionHint(suggestion: Record<string, any> | null) {
  return suggestion?.label
    ? String(suggestion.label).replace(/^上次\s*/, '').replace(/^复制上一组\s*/, '同上 ')
    : '';
}

function applySuggestion(exerciseIndex: number, setIndex: number) {
  const exercise = fitness.activeWorkout?.exercises?.[exerciseIndex];
  const suggestion = exercise ? setSuggestion(exercise, setIndex) : null;
  if (!suggestion) return;
  setDone(exerciseIndex, setIndex, false, suggestion.weight, suggestion.reps);
}

function setDone(exerciseIndex: number, setIndex: number, done: boolean, weight: unknown, reps: unknown) {
  run(() => {
    const result = fitness.completeSet(exerciseIndex, setIndex, { done, weight, reps });
    const exerciseName = fitness.activeWorkout?.exercises?.[exerciseIndex]?.name || '';
    if (done && result?.restSec) startRestTimer(result.restSec, exerciseName);
  });
}

function workoutStatusLabel(status: string) {
  return fitness.services.fitness.getWorkoutStatusLabel(status);
}

function planGoalLabel(goal: string) {
  return fitness.services.fitness.getPlanGoalLabel(goal);
}

resetPlanForm();
resetWorkoutForm();
onUnmounted(stopRestTimer);
</script>

<template>
  <section class="page active" id="page-fitness">
    <header class="page-header fitness-page-header">
      <div>
        <div class="page-title">运动健身</div>
        <p class="page-subtitle">选计划开练，顺手记身材与训练结果。</p>
      </div>
      <div class="fitness-header-actions">
        <button class="btn btn-secondary" type="button" @click="openLibrarySection">动作库</button>
        <button class="btn btn-secondary" type="button" @click="openPlanCreate">新建计划</button>
        <button class="btn btn-primary" type="button" @click="jumpToFreeWorkout">自由开练</button>
      </div>
    </header>

    <p v-if="fitness.lastAction" class="notice success" role="status">{{ fitness.lastAction }}</p>
    <p v-if="formError || fitness.lastError" class="notice warning" role="alert">{{ formError || fitness.lastError }}</p>
    <datalist id="fitness-exercise-datalist">
      <option v-for="item in fitness.library" :key="item.id" :value="item.name" />
    </datalist>

    <section v-if="!fitness.activeWorkout" class="card fitness-overview-hero" aria-label="今日健身状态">
      <div class="section-title-row">
        <div>
          <div class="fitness-kicker">今日状态</div>
          <h2>{{ fitness.plans[0] ? `最近计划：${fitness.plans[0].name}` : '今天还没开始训练' }}</h2>
          <p class="section-hint">先从计划开练，或直接自由开练；身体指标和历史训练都在下方。</p>
        </div>
        <button
          v-if="fitness.plans[0]"
          class="btn btn-primary"
          type="button"
          @click="run(() => fitness.startFromPlan(String(fitness.plans[0].id)))"
        >按计划开练：{{ fitness.plans[0].name }}</button>
      </div>
      <div class="fitness-kpi-grid">
        <article v-for="item in overviewKpis" :key="item.label" class="fitness-kpi-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.hint }}</em>
        </article>
      </div>
    </section>

    <article v-if="fitness.activeWorkout" class="card">
      <div class="section-title-row">
        <div>
          <h2>正在训练：{{ fitness.activeWorkout.title || '自由训练' }}</h2>
          <p class="section-hint">已完成 {{ activeCompleted }}/{{ activeTotal }} 组。每次点击都会立即保存，可安全刷新或稍后继续。</p>
          <label v-if="activePlanDiff" class="fitness-inline-check">
            <input v-model="writeBackPlan" type="checkbox" />
            本场重量/次数变化，结束时回写到计划「{{ activePlan?.name }}」
          </label>
        </div>
        <button class="btn btn-primary" type="button" @click="finishActiveWorkout">结束训练</button>
      </div>
      <div v-if="restTimer.total || restTimer.remaining" class="fitness-rest-timer vue-fitness-rest-timer" role="timer" aria-live="polite">
        <div class="fitness-rest-timer-main">
          <div>
            <div class="fitness-rest-timer-kicker">组间休息<span v-if="restTimer.exerciseName"> · {{ restTimer.exerciseName }}</span></div>
            <div class="fitness-rest-timer-clock">{{ formatClock(restTimer.remaining) }}</div>
          </div>
          <div class="fitness-rest-timer-actions">
            <button class="btn btn-secondary todo-mini-btn" type="button" @click="adjustRestTimer(30)">+30s</button>
            <button class="btn btn-secondary todo-mini-btn" type="button" @click="adjustRestTimer(-30)">-30s</button>
            <button class="btn btn-secondary todo-mini-btn" type="button" @click="stopRestTimer">跳过</button>
          </div>
        </div>
        <div class="fitness-rest-timer-track"><div class="fitness-rest-timer-fill" :style="{ width: `${restTimer.total ? Math.max(0, Math.min(100, (restTimer.remaining / restTimer.total) * 100)) : 0}%` }" /></div>
      </div>
      <article v-for="(exercise, exerciseIndex) in fitness.activeWorkout.exercises" :key="exercise.id || exercise.name" class="card">
        <h3>{{ exercise.name }}</h3>
        <p class="section-hint">
          目标：{{ exercise.targetSets }} 组 × {{ exercise.targetReps }}<span v-if="exercise.targetWeight"> · {{ exercise.targetWeight }} kg</span><span v-if="fitness.services.fitness.getExerciseRestSec(exercise, fitness.library)"> · 休 {{ fitness.services.fitness.getExerciseRestSec(exercise, fitness.library) }}s</span>
          <span v-if="exerciseHistory(exercise)?.set"> · 上次 {{ exerciseHistory(exercise)?.workoutDate }} {{ exerciseHistory(exercise)?.set?.weight ?? '—' }}kg × {{ exerciseHistory(exercise)?.set?.reps ?? '—' }}</span>
        </p>
        <div class="fitness-metric-list">
          <div v-for="(set, setIndex) in exercise.sets" :key="set.id || setIndex" class="fitness-metric-row fitness-live-row">
            <strong>第 {{ setIndex + 1 }} 组</strong>
            <label>重量 <input :value="set.weight ?? ''" type="number" min="0" step="0.5" @change="setDone(exerciseIndex, setIndex, set.done === true, ($event.target as HTMLInputElement).value, set.reps)" /></label>
            <label>次数 <input :value="set.reps ?? ''" type="number" min="1" step="1" @change="setDone(exerciseIndex, setIndex, set.done === true, set.weight, ($event.target as HTMLInputElement).value)" /></label>
            <button v-if="setSuggestion(exercise, setIndex)" class="btn btn-secondary todo-mini-btn" type="button" @click="applySuggestion(exerciseIndex, setIndex)">套用建议</button>
            <button class="btn btn-secondary" type="button" @click="setDone(exerciseIndex, setIndex, set.done !== true, set.weight, set.reps)">
              {{ set.done ? '撤销完成' : '完成本组' }}
            </button>
            <span v-if="suggestionHint(setSuggestion(exercise, setIndex))" class="fitness-set-suggestion vue-fitness-set-suggestion">{{ suggestionHint(setSuggestion(exercise, setIndex)) }}</span>
          </div>
        </div>
      </article>
    </article>

    <div v-else class="form-row" id="fitness-plan-section">
      <form id="fitness-free-start" class="card" @submit.prevent="startFreeWorkout">
        <div class="fitness-section-head">
          <div>
            <div class="section-title">训练计划</div>
            <div class="fitness-section-sub">开练时直接选计划，不用再分训练日。</div>
          </div>
          <button class="btn btn-secondary todo-mini-btn" type="button" @click="openPlanCreate">新建</button>
        </div>
        <div class="card-title">开始自由训练</div>
        <div v-if="!fitness.library.length" class="empty-state">请先初始化或添加动作库。</div>
        <div v-else class="form-row">
          <div class="form-group"><label>训练名称</label><input v-model="freeForm.title" maxlength="80" /></div>
          <div class="form-group"><label>第一个动作</label><select v-model="freeForm.exerciseId" required><option disabled value="">选择动作</option><option v-for="item in fitness.library" :key="item.id" :value="item.id">{{ item.name }}</option></select></div>
        </div>
        <button class="btn btn-primary" type="submit" :disabled="!fitness.library.length">开始训练</button>
      </form>
      <article class="card">
        <div class="card-title">开始计划训练</div>
        <div v-if="fitness.plans.length" class="fitness-metric-list">
          <div v-for="plan in fitness.plans" :key="plan.id" class="fitness-metric-row">
            <div><strong>{{ plan.name }}</strong><span>{{ planGoalLabel(plan.goal) }} · {{ plan.exercises.length }} 个动作</span></div>
            <button class="btn btn-primary" type="button" @click="run(() => fitness.startFromPlan(plan.id))">按计划开练</button>
            <button class="btn btn-secondary" type="button" @click="editPlan(plan)">{{ planEditingId === plan.id ? '正在编辑' : '编辑' }}</button>
            <button class="btn btn-danger" type="button" @click="run(() => fitness.removePlan(plan.id))">删除</button>
          </div>
        </div>
        <div v-else class="empty-state">还没有训练计划。</div>
      </article>
    </div>

    <div class="form-row" id="fitness-body-section">
      <form class="card" @submit.prevent="saveMetric">
        <div class="section-title-row">
          <div>
            <div class="section-title">身材记录</div>
            <p class="fitness-section-sub">体重优先，围度可选填。</p>
            <div class="card-title">{{ metricForm.id ? '编辑身材记录' : '记录身材' }}</div>
          </div>
          <button v-if="metricForm.id" class="btn btn-secondary" type="button" @click="resetMetricForm">取消编辑</button>
        </div>
        <div class="form-row">
          <div class="form-group"><label>日期</label><input v-model="metricForm.date" type="date" /></div>
          <div class="form-group"><label>测量状态</label><select v-model="metricForm.condition"><option v-for="option in conditionOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div>
        </div>
        <div class="form-row fitness-body-field-grid">
          <div v-for="field in metricFields" :key="field.key" class="form-group">
            <label>{{ field.label }}<span v-if="field.unit"> ({{ field.unit }})</span></label>
            <input v-model="metricForm.values[field.key]" inputmode="decimal" :step="field.step || '0.1'" />
          </div>
        </div>
        <div class="form-group"><label>备注</label><input v-model="metricForm.note" /></div>
        <button class="btn btn-primary">{{ metricForm.id ? '保存修改' : '记录身材' }}</button>
      </form>
      <article class="card">
        <div class="card-title">最近身材</div>
        <div v-if="fitness.metrics.length" class="fitness-metric-list">
          <div v-for="item in fitness.metrics.slice(0, 8)" :key="item.id" class="fitness-metric-row fitness-body-metric-row">
            <div>
              <strong>{{ item.date }} · {{ fitness.services.fitness.getConditionLabel(item.condition) }}</strong>
              <span class="fitness-metric-chip-row"><span v-for="chip in metricChips(item)" :key="chip.key">{{ chip.label }} {{ chip.value }}</span></span>
              <span v-if="item.note">{{ item.note }}</span>
            </div>
            <button class="btn btn-secondary" type="button" @click="editMetric(item)">{{ metricForm.id === item.id ? '正在编辑' : '编辑' }}</button>
            <button class="btn btn-danger" type="button" @click="run(() => fitness.removeMetric(item.id))">删除</button>
          </div>
        </div>
        <div v-else class="empty-state">还没有身材记录。</div>
      </article>
    </div>

    <div class="form-row" id="fitness-library-section">
      <form class="card" @submit.prevent="saveLibraryItem">
        <div class="section-title-row"><div><h2>动作库</h2><p class="section-hint">初始化会按旧版默认动作创建可编辑副本。</p></div><button class="btn btn-secondary" type="button" @click="seedLibrary">初始化默认动作</button></div>
        <div class="form-row">
          <div class="form-group"><label>动作名称</label><input v-model="libraryForm.name" required maxlength="80" /></div>
          <div class="form-group"><label>肌群</label><select v-model="libraryForm.muscle"><option v-for="option in muscleOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div>
          <div class="form-group"><label>默认组数</label><input v-model.number="libraryForm.defaultSets" type="number" min="1" max="99" /></div>
          <div class="form-group"><label>默认次数</label><input v-model="libraryForm.defaultReps" placeholder="8-12" /></div>
          <div class="form-group"><label>默认重量 kg</label><input v-model="libraryForm.defaultWeight" inputmode="decimal" /></div>
          <div class="form-group"><label>组间休息 秒</label><input v-model.number="libraryForm.restSec" type="number" min="0" /></div>
        </div>
        <div class="form-group"><label>备注</label><input v-model="libraryForm.note" /></div>
        <button class="btn btn-primary">添加动作</button>
        <div v-if="fitness.library.length" class="fitness-metric-list">
          <div v-for="item in fitness.library" :key="item.id" class="fitness-metric-row"><strong>{{ item.name }}</strong><span>{{ fitness.services.fitness.getMuscleLabel(item.muscle) }} · {{ item.defaultSets }} 组 × {{ item.defaultReps }}</span><button class="btn btn-danger" type="button" @click="run(() => fitness.removeLibraryItem(item.id))">删除</button></div>
        </div>
      </form>

      <form class="card" @submit.prevent="savePlan">
        <div class="section-title-row">
          <div>
            <div class="card-title">{{ planEditingId ? '编辑训练计划' : '创建训练计划' }}</div>
            <p class="section-hint">计划可包含多个动作和每组处方，保存后可直接按计划开练。</p>
          </div>
          <button v-if="planEditingId" class="btn btn-secondary" type="button" @click="resetPlanForm">取消编辑</button>
        </div>
        <div class="form-row">
          <div class="form-group"><label>计划名称</label><input v-model="planForm.name" required maxlength="80" /></div>
          <div class="form-group"><label>目标</label><select v-model="planForm.goal"><option v-for="option in goalOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div>
          <div class="form-group"><label>状态</label><select v-model="planForm.status"><option v-for="option in planStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div>
        </div>
        <div class="form-group"><label>备注</label><input v-model="planForm.notes" /></div>
        <div class="fitness-plan-exercise-list">
          <section v-for="(exercise, exerciseIndex) in planForm.exercises" :key="exercise.localId" class="fitness-plan-exercise-card">
            <div class="fitness-plan-exercise-card-head">
              <input v-model="exercise.name" type="text" list="fitness-exercise-datalist" placeholder="动作名称" required />
              <button class="btn btn-secondary fitness-icon-btn" type="button" :disabled="planForm.exercises.length <= 1" title="删除动作" @click="removePlanExercise(exerciseIndex)">×</button>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>套用动作库</label>
                <select @change="applyLibraryToPlanExercise(exerciseIndex, ($event.target as HTMLSelectElement).value)">
                  <option value="">手动输入</option>
                  <option v-for="item in fitness.library" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </div>
              <div class="form-group"><label>动作备注</label><input v-model="exercise.note" placeholder="角度、节奏或注意事项" /></div>
            </div>
            <div class="fitness-plan-set-table">
              <div class="fitness-plan-set-head">
                <span>组</span>
                <span>重量</span>
                <span>次数</span>
                <span></span>
              </div>
              <div v-for="(set, setIndex) in exercise.sets" :key="set.id || setIndex" class="fitness-plan-set-row">
                <span class="fitness-set-index">{{ setIndex + 1 }}</span>
                <label class="fitness-live-field">
                  <input v-model="set.weight" type="number" min="0" step="0.5" placeholder="kg" />
                  <span class="fitness-live-unit">kg</span>
                </label>
                <label class="fitness-live-field">
                  <input v-model="set.reps" type="number" min="0" step="1" placeholder="次" />
                  <span class="fitness-live-unit">次</span>
                </label>
                <button class="btn btn-secondary fitness-icon-btn" type="button" :disabled="exercise.sets.length <= 1" title="删除组" @click="removePlanSet(exercise, setIndex)">×</button>
              </div>
            </div>
            <div class="fitness-plan-day-actions compact">
              <button class="btn btn-secondary todo-mini-btn" type="button" @click="addPlanSet(exercise)">+ 加一组</button>
            </div>
          </section>
        </div>
        <div class="fitness-plan-day-actions">
          <button class="btn btn-secondary" type="button" @click="addPlanExercise">添加动作</button>
          <button class="btn btn-primary">{{ planEditingId ? '保存计划' : '创建计划' }}</button>
        </div>
      </form>
    </div>

    <form id="fitness-workout-section" class="card" @submit.prevent="saveWorkoutLog">
      <div class="section-title-row">
        <div>
          <div class="section-title">训练日志</div>
          <div class="fitness-section-sub">进行中的训练会置顶，结束后也能补记。</div>
          <div class="card-title">{{ workoutEditingId ? '编辑训练日志' : '补记训练日志' }}</div>
        </div>
        <div class="fitness-header-actions">
          <button class="btn btn-secondary todo-mini-btn" type="button" @click="jumpToFreeWorkout">开练</button>
          <button class="btn btn-secondary todo-mini-btn" type="button" @click="openWorkoutCreate">补记</button>
          <button v-if="workoutEditingId" class="btn btn-secondary" type="button" @click="resetWorkoutForm">取消编辑</button>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>训练日期</label><input v-model="workoutForm.date" type="date" required /></div>
        <div class="form-group"><label>状态</label><select v-model="workoutForm.status"><option v-for="option in workoutStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div>
        <div class="form-group"><label>训练标题</label><input v-model="workoutForm.title" maxlength="80" placeholder="例如 下肢力量" /></div>
        <div class="form-group"><label>时长 分钟</label><input v-model="workoutForm.durationMin" type="number" min="1" step="1" /></div>
        <div class="form-group">
          <label>关联计划</label>
          <select v-model="workoutForm.planId" @change="applyPlanToWorkout(($event.target as HTMLSelectElement).value)">
            <option value="">不关联计划</option>
            <option v-for="plan in fitness.plans" :key="plan.id" :value="plan.id">{{ plan.name }}</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>训练备注</label><input v-model="workoutForm.notes" /></div>
      <div class="fitness-plan-exercise-list">
        <section v-for="(exercise, exerciseIndex) in workoutForm.exercises" :key="exercise.localId" class="fitness-plan-exercise-card">
          <div class="fitness-plan-exercise-card-head">
            <input v-model="exercise.name" type="text" list="fitness-exercise-datalist" placeholder="动作名称" required />
            <button class="btn btn-secondary fitness-icon-btn" type="button" :disabled="workoutForm.exercises.length <= 1" title="删除动作" @click="removeWorkoutExercise(exerciseIndex)">×</button>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>套用动作库</label>
              <select @change="applyLibraryToWorkoutExercise(exerciseIndex, ($event.target as HTMLSelectElement).value)">
                <option value="">手动输入</option>
                <option v-for="item in fitness.library" :key="item.id" :value="item.id">{{ item.name }}</option>
              </select>
            </div>
            <div class="form-group"><label>动作备注</label><input v-model="exercise.note" placeholder="动作备注" /></div>
          </div>
          <div class="fitness-workout-set-list">
            <div class="fitness-workout-set-head">
              <span>组</span>
              <span>重量</span>
              <span>次数</span>
              <span>完成</span>
              <span></span>
            </div>
            <div v-for="(set, setIndex) in exercise.sets" :key="set.id || setIndex" class="fitness-workout-set-row">
              <span class="fitness-set-index">{{ setIndex + 1 }}</span>
              <label class="fitness-live-field">
                <input v-model="set.weight" type="number" min="0" step="0.5" placeholder="kg" />
                <span class="fitness-live-unit">kg</span>
              </label>
              <label class="fitness-live-field">
                <input v-model="set.reps" type="number" min="0" step="1" placeholder="次" />
                <span class="fitness-live-unit">次</span>
              </label>
              <label class="fitness-check-chip compact"><input v-model="set.done" type="checkbox" />完成</label>
              <button class="btn btn-secondary fitness-icon-btn" type="button" :disabled="exercise.sets.length <= 1" title="删除组" @click="removeWorkoutSet(exercise, setIndex)">×</button>
            </div>
          </div>
          <div class="fitness-plan-day-actions compact">
            <button class="btn btn-secondary todo-mini-btn" type="button" @click="addWorkoutSet(exercise)">+ 加一组</button>
          </div>
        </section>
      </div>
      <div class="fitness-plan-day-actions">
        <button class="btn btn-secondary" type="button" @click="addWorkoutExercise">添加动作</button>
        <button class="btn btn-primary">{{ workoutEditingId ? '保存训练日志' : '保存训练日志' }}</button>
      </div>
    </form>

    <article class="card">
      <div class="card-title">训练历史</div>
      <div v-if="doneHistory.length" class="fitness-metric-list">
        <div v-for="workout in doneHistory" :key="workout.id" class="fitness-metric-row">
          <div><strong>{{ workout.date }} · {{ workout.title || '自由训练' }}</strong><span>{{ workoutStatusLabel(workout.status) }} · {{ fitness.services.fitness.countCompletedSets(workout) }}/{{ fitness.services.fitness.countTotalSets(workout) }} 组<span v-if="workout.durationMin"> · {{ workout.durationMin }} 分钟</span></span></div>
          <button class="btn btn-secondary" type="button" @click="editWorkout(workout)">编辑</button>
          <button class="btn btn-danger" type="button" @click="run(() => fitness.removeWorkout(workout.id))">删除</button>
        </div>
      </div>
      <div v-else class="empty-state">完成训练后会显示在这里。</div>
    </article>
  </section>
</template>

<style scoped>
.fitness-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.fitness-overview-hero {
  margin-bottom: 16px;
}
.fitness-section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.fitness-section-sub {
  margin-top: 4px;
  color: var(--muted, #647269);
  font-size: 12px;
  line-height: 1.4;
}
.fitness-kicker {
  color: var(--faint, #7a8b80);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.fitness-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.fitness-kpi-card {
  min-width: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(33, 110, 78, 0.05);
  border: 1px solid rgba(33, 110, 78, 0.1);
  display: grid;
  gap: 4px;
}
.fitness-kpi-card span,
.fitness-kpi-card em {
  color: var(--faint, #7a8b80);
  font-size: 12px;
  font-style: normal;
}
.fitness-kpi-card strong {
  font-size: 1.35rem;
  color: #216e4e;
}
@media (max-width: 900px) {
  .fitness-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .fitness-header-actions {
    width: 100%;
  }
  .fitness-kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
