<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useHabitsStore } from '../stores/habitsStore';

const habits = useHabitsStore();
const route = useRoute();
const name = ref('');
const tag = ref('');
const timesPerDay = ref(1);
const formError = ref('');
const focusedHabitId = computed(() => String(route.query.habit || ''));
const todayItems = computed(() => habits.todayHabits.map(habit => ({
  habit,
  count: habits.getCheckinCount(habit.id),
  target: habits.targetCount(habit),
})));

function addHabit() {
  try {
    habits.create({ name: name.value, tag: tag.value, timesPerDay: timesPerDay.value });
    name.value = '';
    tag.value = '';
    timesPerDay.value = 1;
    formError.value = '';
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  }
}

function checkin(id: string) {
  habits.quickCheckin(id);
}
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
            </div>
          </div>
        </article>
        <div v-if="!todayItems.length" class="empty-state">今日没有按规则待完成的习惯。</div>
      </div>
    </section>

    <section class="card" aria-labelledby="new-habit-title">
      <div class="section-title-row"><h2 id="new-habit-title">添加基础习惯</h2></div>
      <form class="form-grid" @submit.prevent="addHabit">
        <label class="form-field"><span>习惯名称</span><input v-model="name" required maxlength="80" placeholder="例如：晨间阅读" /></label>
        <label class="form-field"><span>分组标签</span><input v-model="tag" maxlength="40" placeholder="例如：学习" /></label>
        <label class="form-field"><span>每天次数</span><input v-model.number="timesPerDay" type="number" min="1" max="99" /></label>
        <div class="form-actions"><button class="btn primary" type="submit">添加习惯</button></div>
      </form>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <p class="section-hint">新建项使用旧版默认字段：每日规则、金币奖励币种、完整里程碑结构；详细规则、提醒、罚款、心愿和同步设置仍请在旧版维护。</p>
    </section>
  </section>
</template>

<style scoped>
.habit-quick-card.is-target { outline: 3px solid rgba(47, 128, 237, .24); outline-offset: 2px; }
</style>
