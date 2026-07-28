<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getTodayStr } from '../services/legacyServices';
import { useHabitsStore } from '../stores/habitsStore';
import type { HabitRule } from '../stores/habitsStore';

const habits = useHabitsStore();
const route = useRoute();
const formError = ref('');
const actionDrafts = reactive<Record<string, { date: string; note: string }>>({});
const checkinNoteDrafts = reactive<Record<string, string>>({});
const focusedHabitId = computed(() => String(route.query.habit || ''));
const todayItems = computed(() => habits.todayHabits.map(habit => ({
  habit,
  count: habits.getCheckinCount(habit.id),
  target: habits.targetCount(habit),
})));
const weekdayOptions = [
  { value: '1', label: '一' },
  { value: '2', label: '二' },
  { value: '3', label: '三' },
  { value: '4', label: '四' },
  { value: '5', label: '五' },
  { value: '6', label: '六' },
  { value: '0', label: '日' },
];
const ruleLabels: Record<string, string> = {
  daily: '每天',
  'weekly-fixed': '每周固定',
  'weekly-count': '每周次数',
  'monthly-count': '每月次数',
  interval: '间隔天数',
};
const habitForm = reactive({
  id: '',
  name: '',
  rule: 'daily',
  weekdays: [] as string[],
  count: 3,
  timesPerDay: 1,
  tag: '',
  goalCount: 0,
  noteMode: 'ask',
});
const editingHabit = computed(() => habitForm.id ? habits.habits.find(item => item.id === habitForm.id) : null);
const formTitle = computed(() => editingHabit.value ? '编辑基础习惯' : '添加基础习惯');

function resetHabitForm() {
  habitForm.id = '';
  habitForm.name = '';
  habitForm.rule = 'daily';
  habitForm.weekdays = [];
  habitForm.count = 3;
  habitForm.timesPerDay = 1;
  habitForm.tag = '';
  habitForm.goalCount = 0;
  habitForm.noteMode = 'ask';
  formError.value = '';
}

function editHabit(item: { id: string; name?: string; rule?: string; weekdays?: unknown; count?: unknown; timesPerDay?: unknown; tag?: string; goalCount?: unknown; noteMode?: string }) {
  habitForm.id = item.id;
  habitForm.name = item.name || '';
  habitForm.rule = item.rule || 'daily';
  habitForm.weekdays = Array.isArray(item.weekdays) ? item.weekdays.map(String) : [];
  habitForm.count = Number(item.count || 3);
  habitForm.timesPerDay = Number(item.timesPerDay || 1);
  habitForm.tag = item.tag || '';
  habitForm.goalCount = Number(item.goalCount || 0);
  habitForm.noteMode = item.noteMode === 'never' ? 'never' : 'ask';
  formError.value = '';
}

function draftFor(habitId: string) {
  if (!actionDrafts[habitId]) actionDrafts[habitId] = { date: getTodayStr(), note: '' };
  return actionDrafts[habitId];
}

function saveHabit() {
  try {
    const input = {
      name: habitForm.name,
      rule: habitForm.rule as HabitRule,
      weekdays: habitForm.weekdays,
      count: habitForm.count,
      timesPerDay: habitForm.timesPerDay,
      tag: habitForm.tag,
      goalCount: habitForm.goalCount,
      noteMode: habitForm.noteMode as 'ask' | 'never',
    };
    const saved = habitForm.id ? habits.updateHabit(habitForm.id, input) : habits.create(input);
    if (saved) resetHabitForm();
    formError.value = '';
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  }
}

function deleteHabit(id: string) {
  const item = habits.habits.find(habit => habit.id === id);
  if (!item) return;
  if (!window.confirm('确定删除这个习惯吗？所有历史打卡记录和时间轴条目都会一起删除')) return;
  if (habits.deleteHabit(id) && habitForm.id === id) resetHabitForm();
}

function checkin(id: string) {
  habits.quickCheckin(id);
}

function appendWithDraft(habitId: string) {
  const draft = draftFor(habitId);
  if (habits.appendCheckin(habitId, draft.date, draft.note)) draft.note = '';
}

function undoWithDraft(habitId: string) {
  const draft = draftFor(habitId);
  habits.undoLatestCheckin(habitId, draft.date);
}

function checkinsForDraft(habitId: string) {
  const draft = draftFor(habitId);
  return habits.getCheckins(habitId, draft.date);
}

function noteDraft(checkin: { id: string; note?: string }) {
  if (!(checkin.id in checkinNoteDrafts)) checkinNoteDrafts[checkin.id] = checkin.note || '';
  return checkinNoteDrafts[checkin.id];
}

function updateNoteDraft(checkinId: string, value: string) {
  checkinNoteDrafts[checkinId] = value;
}

function saveCheckinNote(checkinId: string) {
  habits.editCheckinNote(checkinId, checkinNoteDrafts[checkinId] || '');
}

watch(focusedHabitId, value => {
  if (!value || habitForm.id) return;
  const item = habits.habits.find(habit => habit.id === value);
  if (item) editHabit(item);
}, { immediate: true });
</script>

<template>
  <section class="page active" id="page-habits">
    <header class="page-header">
      <div>
        <div class="page-title">习惯打卡</div>
        <p class="page-subtitle">今天的打卡会保留旧版 checkins、钱包流水与本地 habit-app 镜像格式。</p>
      </div>
    </header>

    <article class="card habit-center-hero">
      <div>
        <h2>今日习惯概览</h2>
        <p>已迁移日常打卡与新建基础习惯。打卡会写入原有 <code>lifePlanData</code>、奖励流水与 <code>habitAppData</code> 本地镜像；远端同步不会由此页面触发。</p>
      </div>
    </article>

    <div v-if="habits.lastAction" class="notice success" role="status">{{ habits.lastAction }}</div>
    <div v-if="habits.lastError" class="notice warning" role="alert">{{ habits.lastError }}</div>

    <div class="habit-kpi-grid">
      <article v-for="(amount, currency) in habits.balances" :key="currency" class="habit-kpi-card">
        <span>{{ currency }}</span>
        <strong>{{ amount }}</strong>
      </article>
      <article v-if="!Object.keys(habits.balances).length" class="habit-kpi-card">
        <span>金币</span>
        <strong>0</strong>
      </article>
    </div>

    <section class="card" aria-labelledby="today-habits-title">
      <div class="section-title-row">
        <div>
          <h2 id="today-habits-title">今日待做</h2>
          <p class="section-hint">多次习惯可继续记录；单次习惯完成后仍可在旧版补充备注或撤销。</p>
        </div>
      </div>
      <div class="habit-quick-list">
        <article v-for="item in todayItems" :key="item.habit.id" class="habit-quick-card compact" :class="{ done: item.count > 0, multi: item.target > 1, 'is-target': focusedHabitId === item.habit.id }" :aria-current="focusedHabitId === item.habit.id ? 'true' : undefined">
          <div class="habit-quick-head">
            <div class="habit-quick-main">
              <div class="habit-quick-title-row">
                <div class="habit-quick-title">{{ item.habit.name }}</div>
                <span class="habit-quick-tag">{{ item.habit.tag || '习惯' }}</span>
                <span class="habit-quick-status" :class="item.count >= item.target ? 'is-done' : item.count ? 'is-active' : 'is-pending'">
                  {{ item.count >= item.target ? '已完成' : item.count ? '进行中' : '待打卡' }}
                </span>
              </div>
              <div class="habit-quick-meta"><span>{{ item.count }}/{{ item.target }} 次</span></div>
            </div>
            <div class="habit-quick-actions compact">
              <button class="habit-quick-btn primary" type="button" :disabled="item.target === 1 && item.count > 0" @click="checkin(item.habit.id)">
                {{ item.target > 1 && item.count > 0 ? '再记一次' : '打卡' }}
              </button>
              <button class="btn btn-secondary habit-edit-shortcut" type="button" @click="editHabit(item.habit)">编辑</button>
            </div>
          </div>
          <div class="habit-correction-panel">
            <div class="habit-correction-form">
              <label><span>日期</span><input v-model="draftFor(item.habit.id).date" type="date" /></label>
              <label><span>备注</span><input v-model="draftFor(item.habit.id).note" maxlength="120" placeholder="本次打卡备注" /></label>
              <button class="btn btn-secondary" type="button" @click="appendWithDraft(item.habit.id)">备注打卡/补卡</button>
              <button class="btn btn-secondary" type="button" :disabled="!checkinsForDraft(item.habit.id).length" @click="undoWithDraft(item.habit.id)">撤销最近一次</button>
            </div>
            <div v-if="checkinsForDraft(item.habit.id).length" class="habit-checkin-note-list">
              <div v-for="checkinItem in checkinsForDraft(item.habit.id)" :key="checkinItem.id" class="habit-checkin-note-row">
                <span>{{ checkinItem.time || checkinItem.checkinAt?.slice(11, 16) || '记录' }}</span>
                <input :value="noteDraft(checkinItem)" maxlength="120" placeholder="备注" @input="updateNoteDraft(checkinItem.id, ($event.target as HTMLInputElement).value)" />
                <button class="btn btn-secondary" type="button" @click="saveCheckinNote(checkinItem.id)">保存备注</button>
              </div>
            </div>
          </div>
        </article>
        <div v-if="!todayItems.length" class="empty-state">今日没有按规则待完成的习惯。</div>
      </div>
    </section>

    <section class="card habit-management-card" aria-labelledby="habit-management-title">
      <div class="section-title-row">
        <div>
          <h2 id="habit-management-title">{{ formTitle }}</h2>
          <p class="section-hint">{{ editingHabit ? `正在编辑：${editingHabit.name}` : '基础字段会沿用旧版数据结构。' }}</p>
        </div>
        <button v-if="editingHabit" class="btn btn-secondary" type="button" @click="resetHabitForm">取消编辑</button>
      </div>
      <form class="habit-editor-form" @submit.prevent="saveHabit">
        <label class="form-field"><span>习惯名称</span><input v-model="habitForm.name" required maxlength="80" placeholder="例如：晨间阅读" /></label>
        <label class="form-field"><span>分组标签</span><input v-model="habitForm.tag" maxlength="40" placeholder="例如：学习" /></label>
        <label class="form-field"><span>规则</span><select v-model="habitForm.rule"><option value="daily">每天</option><option value="weekly-fixed">每周固定</option><option value="weekly-count">每周次数</option><option value="monthly-count">每月次数</option><option value="interval">间隔天数</option></select></label>
        <label class="form-field"><span>每天次数</span><input v-model.number="habitForm.timesPerDay" type="number" min="1" max="99" /></label>
        <label v-if="['weekly-count', 'monthly-count', 'interval'].includes(habitForm.rule)" class="form-field"><span>{{ habitForm.rule === 'interval' ? '间隔天数' : '目标次数' }}</span><input v-model.number="habitForm.count" type="number" min="1" max="99" /></label>
        <label class="form-field"><span>总目标次数</span><input v-model.number="habitForm.goalCount" type="number" min="0" max="99999" /></label>
        <label class="form-field"><span>备注模式</span><select v-model="habitForm.noteMode"><option value="ask">打卡时询问</option><option value="never">不询问</option></select></label>
        <div v-if="habitForm.rule === 'weekly-fixed'" class="habit-weekday-field">
          <span>执行星期</span>
          <label v-for="day in weekdayOptions" :key="day.value"><input v-model="habitForm.weekdays" type="checkbox" :value="day.value" />{{ day.label }}</label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">{{ editingHabit ? '保存习惯' : '添加习惯' }}</button></div>
      </form>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <p class="section-hint">新建项使用旧版默认字段：每日规则、金币奖励币种、完整里程碑结构；详细规则、提醒、罚款、心愿和同步设置仍请在旧版维护。</p>

      <div class="habit-library-table habit-management-table">
        <div class="habit-library-row head">
          <span>习惯</span><span>规则</span><span>次数</span><span>分组</span><span>目标</span><span>操作</span>
        </div>
        <div v-for="item in habits.habits" :key="item.id" class="habit-library-row" :class="{ 'is-target': focusedHabitId === item.id }">
          <span class="habit-library-name"><strong>{{ item.name }}</strong><em>{{ item.startDate || '未设置开始日' }}</em></span>
          <span>{{ ruleLabels[item.rule || 'daily'] || item.rule || '每天' }}</span>
          <span>{{ habits.targetCount(item) }}/日</span>
          <span>{{ item.tag || '习惯' }}</span>
          <span>{{ Number(item.goalCount || 0) || '-' }}</span>
          <span class="habit-library-actions">
            <button class="btn btn-secondary" type="button" @click="editHabit(item)">编辑</button>
            <button class="btn btn-danger" type="button" @click="deleteHabit(item.id)">删除</button>
          </span>
        </div>
        <div v-if="!habits.habits.length" class="empty-state">还没有习惯。</div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.habit-quick-card.is-target { outline: 3px solid rgba(47, 128, 237, .24); outline-offset: 2px; }
.habit-quick-actions.compact {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.habit-edit-shortcut {
  min-height: 36px;
  padding: 7px 11px;
  border-radius: 999px;
  font-size: 12px;
}
.habit-correction-panel {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  max-width: 860px;
  padding: 12px;
  border: 1px solid rgba(42, 75, 56, .10);
  border-radius: 12px;
  background: rgba(248, 251, 249, .82);
}
.habit-correction-form,
.habit-checkin-note-row {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 8px;
}
.habit-correction-form label {
  display: grid;
  min-width: 136px;
  flex: 0 1 190px;
  gap: 4px;
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 700;
}
.habit-correction-form input,
.habit-checkin-note-row input,
.habit-editor-form input,
.habit-editor-form select {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--line, #dfe7e1);
  border-radius: 8px;
  background: #fff;
  color: var(--text, #17211b);
}
.habit-checkin-note-list {
  display: grid;
  gap: 8px;
}
.habit-checkin-note-row span {
  min-width: 48px;
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 750;
}
.habit-checkin-note-row input {
  min-width: 160px;
  flex: 1 1 180px;
}
.habit-management-card {
  display: grid;
  gap: 14px;
}
.habit-editor-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: 12px;
  align-items: end;
  padding: 14px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 12px;
  background: #fbfdfb;
}
.habit-editor-form .form-field {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.habit-editor-form .form-field span,
.habit-weekday-field > span {
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 800;
}
.habit-weekday-field {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  min-height: 38px;
}
.habit-weekday-field label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 5px 9px;
  border: 1px solid #dbe7df;
  border-radius: 999px;
  background: #fff;
  color: var(--text, #17211b);
  font-size: 12px;
  font-weight: 750;
}
.habit-weekday-field input {
  width: 14px;
  height: 14px;
}
.habit-management-table {
  margin-top: 2px;
}
.habit-library-row.is-target {
  background: #f5fbf7;
}
@media (max-width: 520px) {
  .habit-correction-form > *,
  .habit-checkin-note-row > * {
    width: 100%;
  }
}
@media (max-width: 900px) {
  .habit-editor-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 620px) {
  .habit-editor-form {
    grid-template-columns: minmax(0, 1fr);
  }
  .habit-management-table {
    overflow-x: auto;
  }
}
</style>
