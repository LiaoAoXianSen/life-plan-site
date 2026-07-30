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
const rewardForm = reactive({ name: '', cost: 10, currency: '金币', stock: 0, note: '' });
const focusedHabitId = computed(() => String(route.query.habit || ''));
const todayItems = computed(() => habits.todayHabits.map(habit => ({
  habit,
  count: habits.getCheckinCount(habit.id),
  target: habits.targetCount(habit),
})));
const rewardItems = computed(() => [...habits.rewards].sort((a, b) => {
  const archiveRank = Number(Boolean(a.archived)) - Number(Boolean(b.archived));
  if (archiveRank) return archiveRank;
  return String(a.currency || '金币').localeCompare(String(b.currency || '金币'), 'zh-Hans-CN') || Number(a.cost || 0) - Number(b.cost || 0);
}));
const balanceText = computed(() => Object.entries(habits.balances)
  .sort(([a], [b]) => a.localeCompare(b, 'zh-Hans-CN'))
  .map(([currency, amount]) => `${amount} ${currency}`)
  .join(' · ') || '0 金币');
const diagnosticSummary = computed(() => habits.diagnostics.summary || {});
const diagnosticIssues = computed(() => habits.diagnosticIssues.slice(0, 3));
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
const milestoneDays = [7, 15, 21, 30, 90, 180, 365];

function milestoneDefaults() {
  return milestoneDays.map(days => ({
    days,
    enabled: false,
    rewardAmount: 0,
    currency: '金币',
    penaltyAmount: 0,
    penaltyCurrency: '金币',
  }));
}

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
  rewardPoints: 0,
  rewardCurrency: '金币',
  penaltyPoints: 0,
  penaltyCurrency: '金币',
  randomReward: false,
  rewardMin: 0,
  rewardMax: 0,
  breakPenaltyMode: 'none',
  breakPenaltyPoints: 0,
  breakPenaltyCurrency: '金币',
  milestoneRewards: milestoneDefaults(),
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
  habitForm.rewardPoints = 0;
  habitForm.rewardCurrency = '金币';
  habitForm.penaltyPoints = 0;
  habitForm.penaltyCurrency = '金币';
  habitForm.randomReward = false;
  habitForm.rewardMin = 0;
  habitForm.rewardMax = 0;
  habitForm.breakPenaltyMode = 'none';
  habitForm.breakPenaltyPoints = 0;
  habitForm.breakPenaltyCurrency = '金币';
  habitForm.milestoneRewards = milestoneDefaults();
  formError.value = '';
}

function editHabit(item: {
  id: string; name?: string; rule?: string; weekdays?: unknown; count?: unknown; timesPerDay?: unknown; tag?: string; goalCount?: unknown; noteMode?: string;
  rewardPoints?: unknown; rewardCurrency?: string; penaltyPoints?: unknown; penaltyCurrency?: string; randomReward?: boolean; rewardMin?: unknown; rewardMax?: unknown;
  breakPenaltyMode?: string; breakPenaltyPoints?: unknown; breakPenaltyCurrency?: string; milestoneRewards?: unknown;
}) {
  habitForm.id = item.id;
  habitForm.name = item.name || '';
  habitForm.rule = item.rule || 'daily';
  habitForm.weekdays = Array.isArray(item.weekdays) ? item.weekdays.map(String) : [];
  habitForm.count = Number(item.count || 3);
  habitForm.timesPerDay = Number(item.timesPerDay || 1);
  habitForm.tag = item.tag || '';
  habitForm.goalCount = Number(item.goalCount || 0);
  habitForm.noteMode = item.noteMode === 'never' ? 'never' : 'ask';
  habitForm.rewardPoints = Number(item.rewardPoints || 0);
  habitForm.rewardCurrency = item.rewardCurrency || '金币';
  habitForm.penaltyPoints = Number(item.penaltyPoints || 0);
  habitForm.penaltyCurrency = item.penaltyCurrency || item.rewardCurrency || '金币';
  habitForm.randomReward = Boolean(item.randomReward);
  habitForm.rewardMin = Number(item.rewardMin ?? item.rewardPoints ?? 0);
  habitForm.rewardMax = Number(item.rewardMax ?? item.rewardPoints ?? 0);
  habitForm.breakPenaltyMode = ['none', 'fixed', 'stage'].includes(String(item.breakPenaltyMode)) ? String(item.breakPenaltyMode) : 'none';
  habitForm.breakPenaltyPoints = Number(item.breakPenaltyPoints || 0);
  habitForm.breakPenaltyCurrency = item.breakPenaltyCurrency || item.penaltyCurrency || item.rewardCurrency || '金币';
  const supplied = Array.isArray(item.milestoneRewards) ? item.milestoneRewards as Array<Record<string, unknown>> : [];
  habitForm.milestoneRewards = milestoneDefaults().map(fallback => {
    const match = supplied.find(value => Number(value.days) === fallback.days);
    return {
      days: fallback.days,
      enabled: Boolean(match?.enabled),
      rewardAmount: Number(match?.rewardAmount || 0),
      currency: String(match?.currency || '金币'),
      penaltyAmount: Number(match?.penaltyAmount || 0),
      penaltyCurrency: String(match?.penaltyCurrency || match?.currency || '金币'),
    };
  });
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
      rewardPoints: habitForm.rewardPoints,
      rewardCurrency: habitForm.rewardCurrency,
      penaltyPoints: habitForm.penaltyPoints,
      penaltyCurrency: habitForm.penaltyCurrency,
      randomReward: habitForm.randomReward,
      rewardMin: habitForm.rewardMin,
      rewardMax: habitForm.rewardMax,
      breakPenaltyMode: habitForm.breakPenaltyMode as 'none' | 'fixed' | 'stage',
      breakPenaltyPoints: habitForm.breakPenaltyPoints,
      breakPenaltyCurrency: habitForm.breakPenaltyCurrency,
      milestoneRewards: habitForm.milestoneRewards,
    };
    const saved = habitForm.id ? habits.updateHabit(habitForm.id, input) : habits.create(input);
    if (saved) resetHabitForm();
    formError.value = '';
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  }
}

function resetRewardForm() {
  rewardForm.name = '';
  rewardForm.cost = 10;
  rewardForm.currency = '金币';
  rewardForm.stock = 0;
  rewardForm.note = '';
}

function saveReward() {
  try {
    habits.createReward({
      name: rewardForm.name,
      cost: rewardForm.cost,
      currency: rewardForm.currency,
      stock: rewardForm.stock,
      note: rewardForm.note,
    });
    resetRewardForm();
    formError.value = '';
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  }
}

function redeemReward(id: string) {
  const reward = habits.rewards.find(item => item.id === id);
  if (!reward) return;
  if (!window.confirm(`确认兑换「${reward.name}」吗？`)) return;
  habits.redeemReward(id);
}

function archiveReward(id: string, archived: boolean) {
  habits.setRewardArchived(id, archived);
}

function setHabitArchive(id: string, archived: boolean) {
  const item = habits.habits.find(habit => habit.id === id);
  if (!item) return;
  if (archived && !window.confirm(`归档「${item.name}」后，它不会出现在今日待做中。确认继续吗？`)) return;
  habits.setHabitArchived(id, archived);
  if (habitForm.id === id) resetHabitForm();
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

function settlePenalties() {
  habits.settlePenaltiesThroughYesterday();
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

    <section class="card habit-wallet-panel" aria-labelledby="habit-wallet-title">
      <div class="section-title-row">
        <div>
          <h2 id="habit-wallet-title">钱包与心愿</h2>
          <p class="section-hint">兑换会写入旧版 <code>habitPointLedger</code> 的 <code>type: redeem</code> 流水，并更新心愿兑换次数。</p>
        </div>
        <strong class="habit-wallet-total">{{ balanceText }}</strong>
      </div>

      <form class="habit-reward-form" @submit.prevent="saveReward">
        <label class="form-field"><span>心愿名称</span><input v-model="rewardForm.name" required maxlength="80" placeholder="例如：买一本书" /></label>
        <label class="form-field"><span>花费</span><input v-model.number="rewardForm.cost" type="number" min="1" max="999999" /></label>
        <label class="form-field"><span>币种</span><input v-model="rewardForm.currency" maxlength="24" /></label>
        <label class="form-field"><span>库存</span><input v-model.number="rewardForm.stock" type="number" min="0" max="99999" /></label>
        <label class="form-field reward-note"><span>备注</span><input v-model="rewardForm.note" maxlength="120" placeholder="可选" /></label>
        <div class="form-actions"><button class="btn btn-primary" type="submit">新增心愿</button></div>
      </form>

      <div class="habit-wallet-layout">
        <div class="habit-reward-list">
          <article v-for="reward in rewardItems" :key="reward.id" class="habit-reward-card" :class="{ archived: reward.archived }">
            <div>
              <strong>{{ reward.name }}</strong>
              <span>{{ Number(reward.cost || 0) }} {{ reward.currency || '金币' }} · 已兑 {{ Number(reward.redeemedCount || 0) }} · {{ Number(reward.stock || 0) > 0 ? `库存 ${habits.getRewardStockLeft(reward.id)}` : '不限次数' }}</span>
              <p v-if="reward.note">{{ reward.note }}</p>
            </div>
            <div class="habit-reward-actions">
              <button class="btn btn-secondary" type="button" :disabled="!habits.canRedeemReward(reward.id)" @click="redeemReward(reward.id)">兑换</button>
              <button class="btn btn-secondary" type="button" @click="archiveReward(reward.id, !reward.archived)">{{ reward.archived ? '恢复心愿' : '归档心愿' }}</button>
            </div>
          </article>
          <div v-if="!rewardItems.length" class="empty-state">还没有心愿。</div>
        </div>
        <div class="habit-ledger-panel">
          <h3>近期流水</h3>
          <div v-for="entry in habits.latestLedger" :key="entry.id" class="habit-ledger-row" :class="Number(entry.amount || 0) >= 0 ? 'plus' : 'minus'">
            <span>{{ entry.note || entry.type || '积分调整' }}</span>
            <strong>{{ Number(entry.amount || 0) > 0 ? '+' : '' }}{{ Number(entry.amount || 0) }} {{ entry.currency || '金币' }}</strong>
          </div>
          <div v-if="!habits.latestLedger.length" class="empty-state">暂无积分流水。</div>
        </div>
      </div>
    </section>

    <section class="card habit-diagnostics-panel" aria-labelledby="habit-diagnostics-title">
      <div class="section-title-row">
        <div>
          <h2 id="habit-diagnostics-title">习惯诊断</h2>
          <p class="section-hint">只读检查旧版习惯字段、钱包流水、心愿和本地镜像风险；不会修改任何数据。扣分结算会写入 miss/break 流水并重建本地镜像。</p>
        </div>
        <div class="habit-diagnostics-actions">
          <button class="btn btn-secondary" type="button" @click="settlePenalties">结算昨日扣分</button>
          <span class="habit-diagnostics-pill">{{ habits.diagnostics.readOnly ? '只读' : '检查' }}</span>
        </div>
      </div>
      <div class="habit-diagnostics-grid">
        <article><span>权威源</span><strong>{{ habits.diagnostics.authority || 'lifePlanData' }}</strong></article>
        <article><span>习惯/打卡</span><strong>{{ Number(diagnosticSummary.habits || 0) }} / {{ Number(diagnosticSummary.checkins || 0) }}</strong></article>
        <article><span>流水/心愿</span><strong>{{ Number(diagnosticSummary.habitPointLedger || 0) }} / {{ Number(diagnosticSummary.habitRewards || 0) }}</strong></article>
        <article><span>今日进度</span><strong>{{ Number(diagnosticSummary.doneToday || 0) }} / {{ Number(diagnosticSummary.dueToday || 0) }}</strong></article>
      </div>
      <div class="habit-diagnostics-issues">
        <article v-for="issue in diagnosticIssues" :key="issue.type || issue.id || issue.label || issue.title" class="habit-diagnostics-issue" :class="`is-${issue.severity || 'info'}`">
          <strong>{{ issue.label || issue.title || issue.type || issue.id }}</strong>
          <span>{{ issue.hint || issue.message || '需要复核这类旧数据。' }}</span>
        </article>
        <div v-if="!diagnosticIssues.length" class="empty-state">当前没有发现重复 ID、孤儿引用、异常金额或未来打卡。</div>
      </div>
    </section>

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
        <details class="habit-advanced-fields">
          <summary>高级积分与里程碑</summary>
          <div class="habit-advanced-grid">
            <label class="form-field"><span>固定奖励</span><input v-model.number="habitForm.rewardPoints" type="number" min="0" max="99999" /></label>
            <label class="form-field"><span>奖励币种</span><input v-model="habitForm.rewardCurrency" maxlength="24" /></label>
            <label class="form-field"><span>未完成扣分</span><input v-model.number="habitForm.penaltyPoints" type="number" min="0" max="99999" /></label>
            <label class="form-field"><span>扣金币种</span><input v-model="habitForm.penaltyCurrency" maxlength="24" /></label>
            <label class="habit-check-field"><input v-model="habitForm.randomReward" type="checkbox" /><span>使用随机奖励区间</span></label>
            <label v-if="habitForm.randomReward" class="form-field"><span>奖励下限</span><input v-model.number="habitForm.rewardMin" type="number" min="0" max="99999" /></label>
            <label v-if="habitForm.randomReward" class="form-field"><span>奖励上限</span><input v-model.number="habitForm.rewardMax" type="number" min="0" max="99999" /></label>
            <label class="form-field"><span>断签扣分</span><select v-model="habitForm.breakPenaltyMode"><option value="none">不扣分</option><option value="fixed">固定扣分</option><option value="stage">按阶段扣分</option></select></label>
            <label v-if="habitForm.breakPenaltyMode === 'fixed'" class="form-field"><span>断签扣分值</span><input v-model.number="habitForm.breakPenaltyPoints" type="number" min="0" max="99999" /></label>
            <label v-if="habitForm.breakPenaltyMode === 'fixed'" class="form-field"><span>断签币种</span><input v-model="habitForm.breakPenaltyCurrency" maxlength="24" /></label>
          </div>
          <div class="habit-milestone-editor">
            <div class="habit-milestone-head"><span>天数</span><span>奖励</span><span>奖励币种</span><span>罚款</span><span>罚款币种</span></div>
            <div v-for="milestone in habitForm.milestoneRewards" :key="milestone.days" class="habit-milestone-row">
              <label><input v-model="milestone.enabled" type="checkbox" />{{ milestone.days }} 天</label>
              <input v-model.number="milestone.rewardAmount" :aria-label="`${milestone.days} 天奖励`" type="number" min="0" max="99999" />
              <input v-model="milestone.currency" :aria-label="`${milestone.days} 天奖励币种`" maxlength="24" />
              <input v-model.number="milestone.penaltyAmount" :aria-label="`${milestone.days} 天罚款`" type="number" min="0" max="99999" />
              <input v-model="milestone.penaltyCurrency" :aria-label="`${milestone.days} 天罚款币种`" maxlength="24" />
            </div>
          </div>
        </details>
        <div class="form-actions"><button class="btn btn-primary" type="submit">{{ editingHabit ? '保存习惯' : '添加习惯' }}</button></div>
      </form>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <p class="section-hint">新建和编辑会保留旧版规则、积分、断签扣分、里程碑与本地镜像结构；远端同步仍在云同步页面维护。</p>

      <div class="habit-library-table habit-management-table">
        <div class="habit-library-row head">
          <span>习惯</span><span>规则</span><span>次数</span><span>分组</span><span>目标</span><span>操作</span>
        </div>
        <div v-for="item in habits.habits" :key="item.id" class="habit-library-row" :class="{ 'is-target': focusedHabitId === item.id, archived: item.archived }">
          <span class="habit-library-name"><strong>{{ item.name }}</strong><em>{{ item.archived ? '已归档' : (item.startDate || '未设置开始日') }}</em></span>
          <span>{{ ruleLabels[item.rule || 'daily'] || item.rule || '每天' }}</span>
          <span>{{ habits.targetCount(item) }}/日</span>
          <span>{{ item.tag || '习惯' }}</span>
          <span>{{ Number(item.goalCount || 0) || '-' }}</span>
          <span class="habit-library-actions">
            <button class="btn btn-secondary" type="button" @click="editHabit(item)">编辑</button>
            <button class="btn btn-secondary" type="button" @click="setHabitArchive(item.id, !item.archived)">{{ item.archived ? '恢复' : '归档' }}</button>
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
.habit-wallet-panel {
  display: grid;
  gap: 14px;
}
.habit-wallet-total {
  padding: 6px 10px;
  border: 1px solid rgba(42, 75, 56, .12);
  border-radius: 8px;
  background: #fff;
  color: var(--text, #17211b);
  font-size: 13px;
}
.habit-reward-form {
  display: grid;
  grid-template-columns: 1.3fr .7fr .8fr .7fr 1.3fr auto;
  gap: 10px;
  align-items: end;
  padding: 12px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 12px;
  background: #fbfdfb;
}
.habit-reward-form .form-field {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.habit-reward-form .form-field span {
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 800;
}
.habit-reward-form input {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--line, #dfe7e1);
  border-radius: 8px;
  background: #fff;
  color: var(--text, #17211b);
}
.habit-wallet-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(240px, .8fr);
  gap: 14px;
}
.habit-reward-list,
.habit-ledger-panel {
  display: grid;
  gap: 10px;
  align-content: start;
}
.habit-ledger-panel {
  padding: 12px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 12px;
  background: #fbfdfb;
}
.habit-ledger-panel h3 {
  margin: 0;
  font-size: 14px;
}
.habit-reward-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 12px;
  background: #fff;
}
.habit-reward-card.archived,
.habit-library-row.archived {
  opacity: .64;
}
.habit-reward-card strong,
.habit-reward-card span,
.habit-reward-card p {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
}
.habit-reward-card span,
.habit-reward-card p {
  margin: 3px 0 0;
  color: var(--muted, #647269);
  font-size: 12px;
}
.habit-reward-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.habit-ledger-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 0;
  border-top: 1px solid rgba(42, 75, 56, .09);
}
.habit-ledger-row span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.habit-ledger-row.plus strong {
  color: #1d7f4d;
}
.habit-ledger-row.minus strong {
  color: #b84949;
}
.habit-diagnostics-panel {
  display: grid;
  gap: 14px;
}
.habit-diagnostics-pill {
  padding: 5px 9px;
  border: 1px solid rgba(42, 75, 56, .14);
  border-radius: 999px;
  background: #fff;
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 800;
}
.habit-diagnostics-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.habit-diagnostics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.habit-diagnostics-grid article,
.habit-diagnostics-issue {
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(42, 75, 56, .11);
  border-radius: 12px;
  background: #fbfdfb;
}
.habit-diagnostics-grid span,
.habit-diagnostics-issue span {
  display: block;
  color: var(--muted, #647269);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.habit-diagnostics-grid strong,
.habit-diagnostics-issue strong {
  display: block;
  margin-top: 3px;
  color: var(--text, #17211b);
  overflow-wrap: anywhere;
}
.habit-diagnostics-issues {
  display: grid;
  gap: 8px;
}
.habit-diagnostics-issue.is-danger {
  border-color: rgba(184, 73, 73, .28);
  background: #fff8f8;
}
.habit-diagnostics-issue.is-warning {
  border-color: rgba(170, 130, 28, .25);
  background: #fffdf4;
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
.habit-advanced-fields {
  grid-column: 1 / -1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid rgba(42, 75, 56, .12);
  border-radius: 10px;
  background: #fff;
}
.habit-advanced-fields summary {
  cursor: pointer;
  color: var(--text, #17211b);
  font-size: 13px;
  font-weight: 850;
}
.habit-advanced-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(130px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.habit-check-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  color: var(--text, #17211b);
  font-size: 13px;
  font-weight: 750;
}
.habit-check-field input {
  width: 16px;
  height: 16px;
}
.habit-milestone-editor {
  display: grid;
  gap: 7px;
  margin-top: 12px;
}
.habit-milestone-head,
.habit-milestone-row {
  display: grid;
  grid-template-columns: minmax(86px, .8fr) repeat(4, minmax(92px, 1fr));
  gap: 8px;
  align-items: center;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
.habit-milestone-head {
  color: var(--muted, #647269);
  font-size: 12px;
  font-weight: 800;
}
.habit-milestone-row label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  font-weight: 750;
}
.habit-milestone-row input {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  padding: 7px 8px;
  border: 1px solid var(--line, #dfe7e1);
  border-radius: 8px;
  background: #fff;
  color: var(--text, #17211b);
}
.habit-milestone-row label input[type="checkbox"] {
  width: 16px;
  min-height: auto;
  flex: 0 0 auto;
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
  .habit-editor-form,
  .habit-advanced-grid,
  .habit-reward-form,
  .habit-wallet-layout,
  .habit-diagnostics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .habit-reward-form .reward-note,
  .habit-reward-form .form-actions,
  .habit-ledger-panel {
    grid-column: 1 / -1;
  }
  .habit-milestone-head {
    display: none;
  }
  .habit-milestone-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 8px;
    border: 1px solid rgba(42, 75, 56, .10);
    border-radius: 8px;
  }
  .habit-milestone-row label {
    grid-column: 1 / -1;
  }
}
@media (max-width: 620px) {
  .habit-editor-form,
  .habit-advanced-grid,
  .habit-milestone-row,
  .habit-reward-form,
  .habit-wallet-layout,
  .habit-diagnostics-grid,
  .habit-reward-card {
    grid-template-columns: minmax(0, 1fr);
  }
  .habit-reward-actions {
    justify-content: stretch;
  }
  .habit-reward-actions .btn {
    flex: 1 1 120px;
  }
  .habit-management-table {
    overflow-x: auto;
  }
}
</style>
