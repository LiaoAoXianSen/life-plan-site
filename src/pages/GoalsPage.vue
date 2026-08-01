<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { createLegacyServices, genId, getTodayStr } from '../services/legacyServices';
import { useLifePlanStore } from '../stores/lifePlanStore';
import type { DataEntity } from '../types/lifePlan';

type GoalEntity = DataEntity & {
  id: string;
  name?: string;
  period?: string;
  target?: string;
  status?: string;
  progress?: number;
};

const store = useLifePlanStore();
const route = useRoute();
const router = useRouter();
const services = createLegacyServices();
const periodOptions = ['季度', '年度', '长期'];
const statusOptions = ['进行中', '暂停', '已完成'];
const editorOpen = ref(false);
const activeGoalId = ref('');
const formError = ref('');
const nameInput = ref<HTMLInputElement | null>(null);
const form = reactive({ name: '', period: '', target: '', status: '进行中', progress: 0 });

const goals = computed(() => (store.data.goals as GoalEntity[]).slice());
const activeGoals = computed(() => goals.value.filter(goal => goal.status === '进行中'));

function normalizeProgress(goal: Partial<GoalEntity>) {
  if (typeof goal.progress === 'number' && Number.isFinite(goal.progress)) return goal.progress;
  return goal.status === '已完成' ? 100 : 0;
}

function resetForm() {
  Object.assign(form, { name: '', period: '', target: '', status: '进行中', progress: 0 });
  formError.value = '';
}

function syncGoalRoute(goalId = '') {
  const query = { ...route.query };
  if (goalId) query.goal = goalId;
  else delete query.goal;
  void router.replace({ query });
}

function openNewGoal(syncRoute = true) {
  activeGoalId.value = '';
  resetForm();
  editorOpen.value = true;
  void nextTick(() => nameInput.value?.focus());
  if (syncRoute) syncGoalRoute('');
}

function openGoal(goal: GoalEntity, syncRoute = true) {
  activeGoalId.value = goal.id;
  Object.assign(form, {
    name: goal.name || '',
    period: goal.period || '',
    target: goal.target || '',
    status: goal.status || '进行中',
    progress: normalizeProgress(goal),
  });
  formError.value = '';
  editorOpen.value = true;
  void nextTick(() => nameInput.value?.focus());
  if (syncRoute) syncGoalRoute(goal.id);
}

function closeGoal(syncRoute = true) {
  editorOpen.value = false;
  activeGoalId.value = '';
  resetForm();
  if (syncRoute && route.query.goal) syncGoalRoute('');
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && editorOpen.value) closeGoal();
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown));

function saveGoal() {
  const name = form.name.trim();
  if (!name) {
    formError.value = '请输入目标名称';
    return;
  }
  const goalData = {
    name,
    period: form.period,
    target: form.target,
    status: form.status,
    progress: Math.max(0, Math.min(100, Number.parseInt(String(form.progress), 10) || 0)),
  };
  store.mutate(activeGoalId.value ? 'update-goal' : 'create-goal', data => {
    if (activeGoalId.value) {
      const goal = data.goals.find(item => item.id === activeGoalId.value);
      if (goal) Object.assign(goal, goalData);
      return;
    }
    data.goals.push({ id: genId(), ...goalData, createDate: getTodayStr() });
  });
  closeGoal();
}

function deleteGoal() {
  if (!activeGoalId.value || !window.confirm('确定删除这个目标吗？')) return;
  store.mutate('delete-goal', data => {
    const goal = data.goals.find(item => item.id === activeGoalId.value);
    services.sync.markDeletedItem(data, 'goals', activeGoalId.value, { reason: 'manual-delete', name: String(goal?.name || '') });
    data.goals = data.goals.filter(item => item.id !== activeGoalId.value);
  });
  closeGoal();
}

watch(() => route.query.goal, value => {
  const id = String(value || '');
  if (!id) {
    if (editorOpen.value && activeGoalId.value) closeGoal(false);
    return;
  }
  const goal = goals.value.find(item => item.id === id);
  if (goal) openGoal(goal, false);
}, { immediate: true });
</script>

<template>
  <section class="page active" id="page-goals">
    <header class="page-header">
      <div class="page-title">目标管理</div>
      <button class="btn btn-primary" type="button" @click="openNewGoal()">+ 新建目标</button>
    </header>

    <div class="summary-grid goal-summary-grid">
      <div class="summary-card"><strong class="summary-value">{{ activeGoals.length }}</strong><span class="summary-label">进行中</span></div>
      <div class="summary-card"><strong class="summary-value">{{ goals.filter(goal => goal.status === '暂停').length }}</strong><span class="summary-label">暂停</span></div>
      <div class="summary-card"><strong class="summary-value">{{ goals.filter(goal => goal.status === '已完成').length }}</strong><span class="summary-label">已完成</span></div>
      <div class="summary-card"><strong class="summary-value">{{ goals.length ? Math.round(goals.reduce((sum, goal) => sum + normalizeProgress(goal), 0) / goals.length) : 0 }}%</strong><span class="summary-label">平均进度</span></div>
    </div>

    <div class="goal-grid">
      <button v-for="goal in goals" :key="goal.id" class="goal-card goal-card-button" type="button" @click="openGoal(goal)">
        <div class="goal-info">
          <h4>{{ goal.name }} <span>({{ goal.status }})</span></h4>
          <p>{{ goal.period }} · {{ goal.target }}</p>
          <div class="progress-bar"><div class="progress-fill" :style="{ width: `${normalizeProgress(goal)}%` }" /></div>
        </div>
        <strong class="goal-progress">{{ normalizeProgress(goal) }}%</strong>
      </button>
    </div>
    <div v-if="!goals.length" class="empty-state">暂无目标，点击右上角新建</div>

    <div v-if="editorOpen" class="modal-overlay active" role="presentation">
      <form class="modal modal-sm goal-editor" role="dialog" aria-modal="true" aria-labelledby="goal-editor-title" @submit.prevent="saveGoal">
        <div class="modal-header">
          <div class="modal-title" id="goal-editor-title">{{ activeGoalId ? '编辑目标' : '新建目标' }}</div>
          <button class="close-btn" type="button" aria-label="关闭目标编辑" @click="closeGoal()">×</button>
        </div>
        <label class="form-group"><span>目标</span><input ref="nameInput" v-model="form.name" required /></label>
        <label class="form-group"><span>周期</span><select v-model="form.period"><option value="">未设置</option><option v-for="period in periodOptions" :key="period" :value="period">{{ period }}</option></select></label>
        <label class="form-group"><span>目标描述</span><textarea v-model="form.target" rows="4" /></label>
        <label class="form-group"><span>状态</span><select v-model="form.status"><option v-for="status in statusOptions" :key="status" :value="status">{{ status }}</option></select></label>
        <label class="form-group">
          <span>进度 {{ form.progress }}%</span>
          <input v-model.number="form.progress" type="range" min="0" max="100" />
        </label>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-action-row">
          <button v-if="activeGoalId" class="btn btn-danger" type="button" @click="deleteGoal">删除</button>
          <div class="modal-action-right">
            <button class="btn btn-secondary" type="button" @click="closeGoal()">取消</button>
            <button class="btn btn-primary" type="submit">保存</button>
          </div>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
#page-goals,
.goal-grid,
.goal-card,
.goal-info {
  min-width: 0;
}
.goal-summary-grid {
  margin-bottom: 18px;
}
.goal-card-button {
  width: 100%;
  text-align: left;
  border: 0;
  cursor: pointer;
}
.goal-info h4 {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  overflow-wrap: anywhere;
}
.goal-info h4 span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}
.goal-info p {
  overflow-wrap: anywhere;
}
.goal-progress {
  color: var(--primary);
  font-size: 20px;
}
.progress-bar {
  min-width: 0;
}
.goal-editor .form-group > span {
  display: block;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}
.goal-editor .modal-action-row {
  position: sticky;
  bottom: 0;
  padding-top: 14px;
  background: var(--surface);
}
</style>
