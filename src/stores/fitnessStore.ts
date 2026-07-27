import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { createLegacyServices, getTodayStr } from '../services/legacyServices';
import { useLifePlanStore } from './lifePlanStore';

type FitnessEntity = Record<string, any>;

const services = createLegacyServices();

/**
 * Vue-facing adapter around the established fitness service.  It deliberately
 * delegates every shape-changing operation to fitness-service.js so a Vue
 * write remains compatible with the static application and cloud merge.
 */
export const useFitnessStore = defineStore('fitness', () => {
  const lifePlan = useLifePlanStore();
  const lastError = ref('');
  const lastAction = ref('');

  const metrics = computed(() => services.fitness.normalizeBodyMetrics(lifePlan.data.bodyMetrics) as FitnessEntity[]);
  const plans = computed(() => services.fitness.normalizeFitnessPlans(lifePlan.data.fitnessPlans) as FitnessEntity[]);
  const workouts = computed(() => services.fitness.normalizeFitnessWorkouts(lifePlan.data.fitnessWorkouts) as FitnessEntity[]);
  const library = computed(() => services.fitness.normalizeExerciseLibrary(lifePlan.data.exerciseLibrary) as FitnessEntity[]);
  const activeWorkout = computed(() => services.fitness.findActiveWorkout(lifePlan.data.fitnessWorkouts) as FitnessEntity | null);

  function succeed(message: string) {
    lastError.value = '';
    lastAction.value = message;
  }

  function fail(message: string) {
    lastAction.value = '';
    lastError.value = message;
    throw new Error(message);
  }

  function normalize() {
    lifePlan.mutate('normalize-fitness-data', data => services.fitness.normalizeFitnessData(data));
  }

  function saveMetric(input: FitnessEntity, existingId = '') {
    const result = services.fitness.upsertBodyMetric(lifePlan.data.bodyMetrics, input, existingId);
    if (!result.ok) return fail(result.message);
    lifePlan.mutate(existingId ? 'update-body-metric' : 'create-body-metric', data => {
      data.bodyMetrics = result.metrics;
    });
    succeed('身体指标已保存');
    return result.metric as FitnessEntity;
  }

  function removeMetric(id: string) {
    const metric = lifePlan.data.bodyMetrics.find(item => item.id === id);
    if (!metric) return;
    lifePlan.mutate('delete-body-metric', data => {
      services.sync.markDeletedItem(data, 'bodyMetrics', id, { reason: 'vue-delete-body-metric' });
      data.bodyMetrics = services.fitness.removeBodyMetric(data.bodyMetrics, id);
    });
    succeed('身体指标已删除');
  }

  function ensureLibrary() {
    lifePlan.mutate('seed-exercise-library', data => {
      // Run the legacy normalizer immediately before seeding so old records
      // and library data get the same compatibility treatment as the static UI.
      services.fitness.normalizeFitnessData(data);
      data.exerciseLibrary = services.fitness.ensureExerciseLibrary(data.exerciseLibrary, data.fitnessWorkouts);
    });
    succeed('动作库已就绪');
  }

  function saveLibraryItem(input: FitnessEntity, existingId = '') {
    const result = services.fitness.upsertExerciseLibraryItem(lifePlan.data.exerciseLibrary, input, existingId);
    if (!result.ok) return fail(result.message);
    lifePlan.mutate(existingId ? 'update-exercise-library-item' : 'create-exercise-library-item', data => {
      data.exerciseLibrary = result.library;
    });
    succeed(existingId ? '动作已更新' : '动作已加入动作库');
    return result.item as FitnessEntity;
  }

  function removeLibraryItem(id: string) {
    const item = lifePlan.data.exerciseLibrary.find(entry => entry.id === id);
    if (!item) return;
    lifePlan.mutate('delete-exercise-library-item', data => {
      services.sync.markDeletedItem(data, 'exerciseLibrary', id, { name: item.name, reason: 'vue-delete-exercise-library-item' });
      data.exerciseLibrary = services.fitness.removeExerciseLibraryItem(data.exerciseLibrary, id);
    });
    succeed('动作已从动作库删除；历史训练不会受影响');
  }

  function savePlan(input: FitnessEntity, existingId = '') {
    const result = services.fitness.upsertFitnessPlan(lifePlan.data.fitnessPlans, input, existingId);
    if (!result.ok) return fail(result.message);
    lifePlan.mutate(existingId ? 'update-fitness-plan' : 'create-fitness-plan', data => {
      data.fitnessPlans = result.plans;
    });
    succeed(existingId ? '训练计划已更新' : '训练计划已创建');
    return result.plan as FitnessEntity;
  }

  function removePlan(id: string) {
    const plan = lifePlan.data.fitnessPlans.find(item => item.id === id);
    if (!plan) return;
    lifePlan.mutate('delete-fitness-plan', data => {
      services.sync.markDeletedItem(data, 'fitnessPlans', id, { name: plan.name, reason: 'vue-delete-fitness-plan' });
      data.fitnessPlans = services.fitness.removeFitnessPlan(data.fitnessPlans, id);
    });
    succeed('训练计划已删除；既有训练历史会保留');
  }

  function startFromPlan(planId: string) {
    if (activeWorkout.value) return fail('已有进行中的训练，请先结束该训练。');
    const plan = services.fitness.findFitnessPlan(lifePlan.data.fitnessPlans, planId);
    if (!plan) return fail('找不到训练计划');
    const liveWorkout = services.fitness.startLiveWorkout(services.fitness.createWorkoutFromPlan(plan));
    const result = services.fitness.upsertFitnessWorkout(lifePlan.data.fitnessWorkouts, liveWorkout);
    if (!result.ok) return fail(result.message);
    lifePlan.mutate('start-workout-from-plan', data => {
      data.fitnessWorkouts = result.workouts;
    });
    succeed(`已开始：${result.workout.title || plan.name}`);
    return result.workout as FitnessEntity;
  }

  function startFreeWorkout(exerciseId: string, title = '自由训练') {
    if (activeWorkout.value) return fail('已有进行中的训练，请先结束该训练。');
    const item = services.fitness.findExerciseLibraryItem(lifePlan.data.exerciseLibrary, exerciseId);
    if (!item) return fail('请先从动作库选择一个动作');
    const draft = services.fitness.createFitnessWorkoutDraft({
      date: getTodayStr(),
      title: title.trim() || '自由训练',
      exercises: [services.fitness.createWorkoutExerciseFromLibrary(item)],
    });
    const liveWorkout = services.fitness.startLiveWorkout(draft);
    const result = services.fitness.upsertFitnessWorkout(lifePlan.data.fitnessWorkouts, liveWorkout);
    if (!result.ok) return fail(result.message);
    lifePlan.mutate('start-free-workout', data => {
      data.fitnessWorkouts = result.workouts;
    });
    succeed(`已开始：${result.workout.title || '自由训练'}`);
    return result.workout as FitnessEntity;
  }

  function completeSet(exerciseIndex: number, setIndex: number, input: { weight?: unknown; reps?: unknown; done?: boolean } = {}) {
    const current = activeWorkout.value;
    if (!current) return fail('当前没有进行中的训练');
    const history = services.fitness.findLastExercisePerformance(
      lifePlan.data.fitnessWorkouts,
      current.exercises?.[exerciseIndex]?.name || '',
      current.id,
    );
    const completed = services.fitness.completeWorkoutSet(current, exerciseIndex, setIndex, {
      ...input,
      history,
      library: lifePlan.data.exerciseLibrary,
      autoFill: false,
    });
    if (!completed.ok) return fail(completed.message);
    const result = services.fitness.upsertFitnessWorkout(lifePlan.data.fitnessWorkouts, completed.workout, current.id);
    if (!result.ok) return fail(result.message);
    lifePlan.mutate('complete-workout-set', data => {
      data.fitnessWorkouts = result.workouts;
    });
    succeed(input.done === false ? '该组已标记为未完成' : '本组已完成');
    return { workout: result.workout as FitnessEntity, restSec: completed.restSec as number };
  }

  function finishWorkout() {
    const current = activeWorkout.value;
    if (!current) return fail('当前没有进行中的训练');
    const finished = services.fitness.finishLiveWorkout(current);
    const result = services.fitness.upsertFitnessWorkout(lifePlan.data.fitnessWorkouts, finished, current.id);
    if (!result.ok) return fail(result.message);
    lifePlan.mutate('finish-live-workout', data => {
      data.fitnessWorkouts = result.workouts;
    });
    succeed('训练已结束并写入历史');
    return result.workout as FitnessEntity;
  }

  function removeWorkout(id: string) {
    const workout = lifePlan.data.fitnessWorkouts.find(item => item.id === id);
    if (!workout) return;
    lifePlan.mutate('delete-fitness-workout', data => {
      services.sync.markDeletedItem(data, 'fitnessWorkouts', id, { title: workout.title, reason: 'vue-delete-fitness-workout' });
      data.fitnessWorkouts = services.fitness.removeFitnessWorkout(data.fitnessWorkouts, id);
    });
    succeed('训练历史已删除');
  }

  return {
    metrics, plans, workouts, library, activeWorkout, lastError, lastAction,
    normalize, saveMetric, removeMetric, ensureLibrary, saveLibraryItem, removeLibraryItem,
    savePlan, removePlan, startFromPlan, startFreeWorkout, completeSet, finishWorkout, removeWorkout,
    services,
  };
});
