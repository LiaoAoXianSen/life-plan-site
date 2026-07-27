import { createRouter, createWebHashHistory } from 'vue-router';

import FeaturePlaceholderPage from '../pages/FeaturePlaceholderPage.vue';
import DashboardPage from '../pages/DashboardPage.vue';
import TodosPage from '../pages/TodosPage.vue';
import RecordsPage from '../pages/RecordsPage.vue';

const router = createRouter({
  // Hash routing avoids Cloudflare Pages refresh 404s during the phased migration.
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: DashboardPage, meta: { title: '首页仪表盘', phase: '第 1 步' } },
    { path: '/todos', name: 'todos', component: TodosPage, meta: { title: '待办总览', phase: '第 2 步' } },
    { path: '/records', name: 'records', component: RecordsPage, meta: { title: '所有记录', phase: '第 3 步' } },
    { path: '/ideas', name: 'ideas', component: FeaturePlaceholderPage, meta: { title: '灵感池', phase: '第 4 步' } },
    { path: '/materials', name: 'materials', component: FeaturePlaceholderPage, meta: { title: '素材库', phase: '第 4 步' } },
    { path: '/tags', name: 'tags', component: FeaturePlaceholderPage, meta: { title: '标签中心', phase: '第 5 步' } },
    { path: '/search', name: 'search', component: FeaturePlaceholderPage, meta: { title: '全局搜索', phase: '第 5 步' } },
    { path: '/habits', name: 'habits', component: FeaturePlaceholderPage, meta: { title: '习惯打卡', phase: '第 6 步' } },
    { path: '/fitness', name: 'fitness', component: FeaturePlaceholderPage, meta: { title: '运动健身', phase: '第 6 步' } },
    { path: '/goals', name: 'goals', component: FeaturePlaceholderPage, meta: { title: '目标管理', phase: '第 6 步' } },
    { path: '/wheel', name: 'wheel', component: FeaturePlaceholderPage, meta: { title: '工具转盘', phase: '第 6 步' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

export default router;
