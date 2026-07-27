<script setup lang="ts">
import { computed } from 'vue';
import { getTodayStr } from '../services/legacyServices';
import { useLifePlanStore } from '../stores/lifePlanStore';
const store = useLifePlanStore(); const today = getTodayStr();
const habits = computed(() => store.data.habits.map(habit => ({ habit, count: store.data.checkins.filter(checkin => checkin.habitId === habit.id && checkin.date === today).length, target: Math.max(1, Number(habit.timesPerDay || 1)) })));
const balances = computed(() => store.data.habitPointLedger.reduce<Record<string, number>>((sum, entry) => { const currency = String(entry.currency || '金币'); sum[currency] = (sum[currency] || 0) + Number(entry.amount || 0); return sum; }, {}));
</script>
<template><section class="page active" id="page-habits"><header class="page-header"><div class="page-title">习惯打卡</div></header><article class="card habit-center-hero"><div><h2>今日习惯概览</h2><p>习惯奖励、罚金、里程碑、镜像诊断及受保护远端流程仍保留原有数据契约；本迁移视图当前只读，避免在未完成状态机移植前改变账本。</p></div></article><div class="habit-kpi-grid"><article v-for="(amount, currency) in balances" :key="currency" class="habit-kpi-card"><span>{{ currency }}</span><strong>{{ amount }}</strong></article></div><div class="habit-quick-list"><article v-for="item in habits" :key="String(item.habit.id)" class="habit-quick-card"><div><strong>{{ item.habit.name }}</strong><span>{{ item.habit.tag || '习惯' }}</span></div><div>{{ item.count }}/{{ item.target }} 次</div></article><div v-if="!habits.length" class="empty-state">还没有习惯数据。</div></div></section></template>
