<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import { getTodayStr } from '../services/legacyServices';
import { useFitnessStore } from '../stores/fitnessStore';

const fitness = useFitnessStore();
const metricForm = reactive({ date: getTodayStr(), weight: '', bodyFat: '', waist: '', note: '' });
const libraryForm = reactive({ name: '', muscle: 'other', defaultSets: 3, defaultReps: '8-12', defaultWeight: '', restSec: 90, note: '' });
const planForm = reactive({ name: '', goal: 'general', exerciseId: '', targetSets: 3, targetReps: '8-12', targetWeight: '', notes: '' });
const freeForm = reactive({ title: '自由训练', exerciseId: '' });
const formError = ref('');

const doneHistory = computed(() => fitness.workouts.filter(item => item.status === 'done' || item.status === 'skipped'));
const activeCompleted = computed(() => fitness.activeWorkout ? fitness.services.fitness.countCompletedSets(fitness.activeWorkout) : 0);
const activeTotal = computed(() => fitness.activeWorkout ? fitness.services.fitness.countTotalSets(fitness.activeWorkout) : 0);
const muscleOptions = computed(() => fitness.services.fitness.EXERCISE_MUSCLE_OPTIONS);
const goalOptions = computed(() => fitness.services.fitness.PLAN_GOAL_OPTIONS);

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
    if (!planForm.exerciseId && fitness.library[0]) planForm.exerciseId = fitness.library[0].id;
  });
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
    if (!planForm.exerciseId) planForm.exerciseId = item.id;
  });
}

function savePlan() {
  run(() => {
    const libraryItem = fitness.library.find(item => item.id === planForm.exerciseId);
    if (!libraryItem) throw new Error('请先从动作库选择一个动作');
    const exercise = fitness.services.fitness.createWorkoutExerciseFromLibrary(libraryItem, {
      targetSets: planForm.targetSets,
      targetReps: planForm.targetReps,
      targetWeight: planForm.targetWeight || undefined,
    });
    fitness.savePlan({
      name: planForm.name,
      goal: planForm.goal,
      status: 'active',
      notes: planForm.notes,
      exercises: [exercise],
    });
    Object.assign(planForm, { name: '', goal: 'general', exerciseId: fitness.library[0]?.id || '', targetSets: 3, targetReps: '8-12', targetWeight: '', notes: '' });
  });
}

function startFreeWorkout() {
  run(() => fitness.startFreeWorkout(freeForm.exerciseId, freeForm.title));
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

    <article v-if="fitness.activeWorkout" class="card">
      <div class="section-title-row">
        <div>
          <h2>正在训练：{{ fitness.activeWorkout.title || '自由训练' }}</h2>
          <p class="section-hint">已完成 {{ activeCompleted }}/{{ activeTotal }} 组。每次点击都会立即保存，可安全刷新或稍后继续。</p>
        </div>
        <button class="btn btn-primary" type="button" @click="run(() => fitness.finishWorkout())">结束训练</button>
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
        <div class="card-title">创建基础训练计划</div>
        <p class="section-hint">当前计划先支持一个动作；完整多动作计划编辑会在后续阶段接入。</p>
        <div class="form-row">
          <div class="form-group"><label>计划名称</label><input v-model="planForm.name" required maxlength="80" /></div>
          <div class="form-group"><label>目标</label><select v-model="planForm.goal"><option v-for="option in goalOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></div>
          <div class="form-group"><label>动作</label><select v-model="planForm.exerciseId" required><option disabled value="">选择动作</option><option v-for="item in fitness.library" :key="item.id" :value="item.id">{{ item.name }}</option></select></div>
          <div class="form-group"><label>组数</label><input v-model.number="planForm.targetSets" type="number" min="1" max="99" /></div>
          <div class="form-group"><label>次数</label><input v-model="planForm.targetReps" /></div>
          <div class="form-group"><label>重量 kg</label><input v-model="planForm.targetWeight" inputmode="decimal" /></div>
        </div>
        <div class="form-group"><label>备注</label><input v-model="planForm.notes" /></div>
        <button class="btn btn-primary" :disabled="!fitness.library.length">创建计划</button>
      </form>
    </div>

    <article class="card">
      <div class="card-title">训练历史</div>
      <div v-if="doneHistory.length" class="fitness-metric-list">
        <div v-for="workout in doneHistory" :key="workout.id" class="fitness-metric-row">
          <div><strong>{{ workout.date }} · {{ workout.title || '自由训练' }}</strong><span>{{ workoutStatusLabel(workout.status) }} · {{ fitness.services.fitness.countCompletedSets(workout) }}/{{ fitness.services.fitness.countTotalSets(workout) }} 组<span v-if="workout.durationMin"> · {{ workout.durationMin }} 分钟</span></span></div>
          <button class="btn btn-danger" type="button" @click="run(() => fitness.removeWorkout(workout.id))">删除</button>
        </div>
      </div>
      <div v-else class="empty-state">完成训练后会显示在这里。</div>
    </article>
  </section>
</template>
