<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import CalendarViews from '../components/CalendarViews.vue';
import { buildScheduleItems, addDays, getMonthStart, getWeekStart } from '../utils/schedule';
import { useLifePlanStore } from '../stores/lifePlanStore';
import { useRecordsStore } from '../stores/recordsStore';

const lifePlan = useLifePlanStore();
const records = useRecordsStore();
const form = reactive({ title: '', content: '', type: '记录', startDate: new Date().toISOString().slice(0, 10), recordTime: '', recordEndTime: '' });
const view = ref<'list' | 'day' | 'week' | 'month'>('list');
const cursor = ref(new Date().toISOString().slice(0, 10));
const keyword = ref('');
const typeFilter = ref('all');
const listRange = ref<'7' | '30' | '90' | 'all'>('30');
const typeOptions = computed(() => [...new Set(lifePlan.data.records.map(record => String(record.type || '')).filter(Boolean))]);
const listRecords = computed(() => {
  const min = listRange.value === 'all' ? '' : addDays(new Date().toISOString().slice(0, 10), -Number(listRange.value) + 1);
  const query = keyword.value.trim().toLowerCase();
  return lifePlan.data.records.filter(record => !record.isHabitRecord)
    .filter(record => !min || String(record.startDate || '') >= min)
    .filter(record => typeFilter.value === 'all' || record.type === typeFilter.value)
    .filter(record => !query || [record.title, record.content, record.type, record.ideaStatus, ...(Array.isArray(record.ideaTags) ? record.ideaTags : [])].filter(Boolean).join(' ').toLowerCase().includes(query))
    .slice().sort((a, b) => String(b.updatedAt || b.createdAt || b.startDate || '').localeCompare(String(a.updatedAt || a.createdAt || a.startDate || '')));
});
const calendarRange = computed(() => view.value === 'day' ? [cursor.value, cursor.value] : view.value === 'week' ? (() => { const start = getWeekStart(cursor.value); return [start, addDays(start, 6)] as const; })() : [getWeekStart(getMonthStart(cursor.value)), addDays(getMonthStart(cursor.value), 41)] as const);
const calendarItems = computed(() => buildScheduleItems(lifePlan.data, calendarRange.value[0], calendarRange.value[1], keyword.value, typeFilter.value));
const viewTitle = computed(() => view.value === 'list' ? '全部记录' : view.value === 'day' ? cursor.value : view.value === 'week' ? `${calendarRange.value[0]} ~ ${calendarRange.value[1]}` : cursor.value.slice(0, 7));
function shift(amount: number) { cursor.value = view.value === 'month' ? (() => { const date = new Date(`${cursor.value.slice(0, 7)}-01T12:00:00`); date.setMonth(date.getMonth() + amount); return date.toISOString().slice(0, 10); })() : addDays(cursor.value, view.value === 'week' ? amount * 7 : amount); }
function addRecord() { if (!form.title.trim()) return; records.addRecord({ ...form, title: form.title.trim(), endDate: form.startDate }); Object.assign(form, { title: '', content: '', type: '记录', startDate: new Date().toISOString().slice(0, 10), recordTime: '', recordEndTime: '' }); }
function removeRecord(id: string) { records.remove('records', id); }
</script>

<template>
  <section class="page active" id="page-records"><header class="page-header"><div class="page-title">所有记录</div></header><form class="card" @submit.prevent="addRecord"><div class="card-title">新建记录</div><div class="form-row"><label class="form-group"><span>标题</span><input v-model="form.title" required placeholder="记录一件事" /></label><label class="form-group"><span>类型</span><input v-model="form.type" /></label><label class="form-group"><span>日期</span><input v-model="form.startDate" type="date" /></label><label class="form-group"><span>开始时间</span><input v-model="form.recordTime" type="time" /></label><label class="form-group"><span>结束时间</span><input v-model="form.recordEndTime" type="time" /></label></div><label class="form-group"><span>内容</span><textarea v-model="form.content" /></label><button class="btn btn-primary">保存记录</button></form><div class="filter-bar"><input v-model="keyword" type="search" placeholder="搜索标题、内容、类型" /><select v-model="typeFilter"><option value="all">全部类型</option><option v-for="type in typeOptions" :key="type" :value="type">{{ type }}</option><option value="待办">待办执行</option><option value="习惯">习惯打卡</option></select><select v-if="view === 'list'" v-model="listRange"><option value="7">最近 7 天</option><option value="30">最近 30 天</option><option value="90">最近 90 天</option><option value="all">全部历史</option></select></div><div class="calendar-toolbar"><div class="segmented"><button v-for="item in ['list','day','week','month'] as const" :key="item" :class="{ active: view === item }" type="button" @click="view = item">{{ ({ list: '列表', day: '日', week: '周', month: '月' })[item] }}</button></div><template v-if="view !== 'list'"><div class="page-actions"><button class="btn btn-secondary" type="button" @click="shift(-1)">上一{{ view === 'month' ? '月' : view === 'week' ? '周' : '天' }}</button><strong id="record-view-title">{{ viewTitle }}</strong><button class="btn btn-secondary" type="button" @click="shift(1)">下一{{ view === 'month' ? '月' : view === 'week' ? '周' : '天' }}</button><button class="btn btn-secondary" type="button" @click="cursor = new Date().toISOString().slice(0, 10)">今天</button></div></template></div><div id="all-records"><template v-if="view === 'list'"><div v-if="listRecords.length"><article v-for="record in listRecords" :key="String(record.id)" class="record-row"><div class="record-time">{{ String(record.recordTime || record.startDate || '').slice(0, 10) }}</div><div class="timeline-item"><span class="item-type">{{ record.type || '记录' }}</span><span class="item-title">{{ record.title || '无标题' }}</span><div v-if="record.ideaStatus" class="item-meta"><span>{{ record.ideaStatus }}</span><span v-for="tag in Array.isArray(record.ideaTags) ? record.ideaTags : []" :key="String(tag)">{{ tag }}</span></div><p v-if="record.content" class="item-preview">{{ record.content }}</p><button class="btn btn-danger" type="button" @click="removeRecord(String(record.id))">删除</button></div></article></div><div v-else class="empty-state">暂无匹配记录。</div></template><CalendarViews v-else :mode="view" :cursor="cursor" :items="calendarItems" /></div></section>
</template>
