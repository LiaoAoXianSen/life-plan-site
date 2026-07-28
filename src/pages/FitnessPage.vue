<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

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
const metricForm = reactive({ date: getTodayStr(), weight: '', bodyFat: '', waist: '', note: '' });
const libraryForm = reactive({ name: '', muscle: 'other', defaultSets: 3, defaultReps: '8-12', defaultWeight: '', restSec: 90, note: '' });
const planForm = reactive({ name: '', goal: 'general', status: 'active', notes: '', exercises: [] as PlanExerciseDraft[] });
const workoutForm = reactive({ date: getTodayStr(), status: 'done', title: '', planId: '', durationMin: '', notes: '', exercises: [] as WorkoutExerciseDraft[] });
const freeForm = reactive({ title: '自由训练', exerciseId: '' });
const formError = ref('');
const planEditingId = ref('');
const workoutEditingId = ref('');
const writeBackPlan = ref(false);

const doneHistory = computed(() => fitness.workouts.filter(item => item.status === 'done' || item.status === 'skipped'));
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

function saveMetric() {
  run(() => {
    fitness.saveMetric({
      date: metricForm.date,
      weight: metricForm.weight,
      bodyFat: metricForm.bodyFat,
      waist: metricForm.waist,
      note: metricForm.note,
    });
    Object.assign(metricForm, { date: getTodayStr(), weight: '', bodyFat: '', waist: '', note: '' });
  });
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

function setDone(exerciseIndex: number, setIndex: number, done: boolean, weight: unknown, reps: unknown) {
  run(() => fitness.completeSet(exerciseIndex, setIndex, { done, weight, reps }));
}

function workoutStatusLabel(status: string) {
  return fitness.services.fitness.getWorkoutStatusLabel(status);
}

function planGoalLabel(goal: string) {
  return fitness.services.fitness.getPlanGoalLabel(goal);
}

resetPlanForm();
resetWorkoutForm();
</script>

<template>
  <section class="page active" id="page-fitness">
    <header class="page-header">
      <div>
        <div class="page-title">运动健身</div>
        <p class="page-subtitle">训练、动作库和身体指标均通过原有健身服务写入 <code>lifePlanData</code>。</p>
      </div>
    </header>

    <p v-if="fitness.lastAction" class="notice success" role="status">{{ fitness.lastAction }}</p>
    <p v-if="formError || fitness.lastError" class="notice warning" role="alert">{{ formError || fitness.lastError }}</p>
    <datalist id="fitness-exercise-datalist">
      <option v-for="item in fitness.library" :key="item.id" :value="item.name" />
    </datalist>

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
      <article v-for="(exercise, exerciseIndex) in fitness.activeWorkout.exercises" :key="exercise.id || exercise.name" class="card">
        <h3>{{ exercise.name }}</h3>
        <p class="section-hint">目标：{{ exercise.targetSets }} 组 × {{ exercise.targetReps }}<span v-if="exercise.targetWeight"> · {{ exercise.targetWeight }} kg</span></p>
        <div class="fitness-metric-list">
          <div v-for="(set, setIndex) in exercise.sets" :key="set.id || setIndex" class="fitness-metric-row">
            <strong>第 {{ setIndex + 1 }} 组</strong>
            <label>重量 <input :value="set.weight ?? ''" type="number" min="0" step="0.5" @change="setDone(exerciseIndex, setIndex, set.done === true, ($event.target as HTMLInputElement).value, set.reps)" /></label>
            <label>次数 <input :value="set.reps ?? ''" type="number" min="1" step="1" @change="setDone(exerciseIndex, setIndex, set.done === true, set.weight, ($event.target as HTMLInputElement).value)" /></label>
            <button class="btn btn-secondary" type="button" @click="setDone(exerciseIndex, setIndex, set.done !== true, set.weight, set.reps)">
              {{ set.done ? '撤销完成' : '完成本组' }}
            </button>
          </div>
        </div>
      </article>
    </article>

    <div v-else class="form-row">
      <form class="card" @submit.prevent="startFreeWorkout">
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

    <div class="form-row">
      <form class="card" @submit.prevent="saveMetric">
        <div class="card-title">记录身体指标</div>
        <div class="form-row">
          <div class="form-group"><label>日期</label><input v-model="metricForm.date" type="date" /></div>
          <div class="form-group"><label>体重 (kg)</label><input v-model="metricForm.weight" inputmode="decimal" /></div>
          <div class="form-group"><label>体脂 (%)</label><input v-model="metricForm.bodyFat" inputmode="decimal" /></div>
          <div class="form-group"><label>腰围 (cm)</label><input v-model="metricForm.waist" inputmode="decimal" /></div>
        </div>
        <div class="form-group"><label>备注</label><input v-model="metricForm.note" /></div>
        <button class="btn btn-primary">保存指标</button>
      </form>
      <article class="card">
        <div class="card-title">最近指标</div>
        <div v-if="fitness.metrics.length" class="fitness-metric-list">
          <div v-for="item in fitness.metrics.slice(0, 8)" :key="item.id" class="fitness-metric-row">
            <strong>{{ item.date }}</strong><span v-if="item.weight != null">体重 {{ item.weight }} kg</span><span v-if="item.bodyFat != null">体脂 {{ item.bodyFat }}%</span><span v-if="item.waist != null">腰围 {{ item.waist }} cm</span><span>{{ item.note }}</span>
            <button class="btn btn-danger" type="button" @click="run(() => fitness.removeMetric(item.id))">删除</button>
          </div>
        </div>
        <div v-else class="empty-state">还没有身体指标记录。</div>
      </article>
    </div>

    <div class="form-row">
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

    <form class="card" @submit.prevent="saveWorkoutLog">
      <div class="section-title-row">
        <div>
          <div class="card-title">{{ workoutEditingId ? '编辑训练日志' : '补记训练日志' }}</div>
          <p class="section-hint">可记录已完成或计划中的训练，动作与组数据仍由旧版健身服务规范化。</p>
        </div>
        <button v-if="workoutEditingId" class="btn btn-secondary" type="button" @click="resetWorkoutForm">取消编辑</button>
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
