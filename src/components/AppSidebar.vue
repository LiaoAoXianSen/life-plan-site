<script setup lang="ts">
const navigation = [
  { to: '/dashboard', icon: '📊', label: '首页仪表盘' },
  { to: '/records', icon: '📝', label: '所有记录' },
  { to: '/ideas', icon: '💡', label: '灵感池' },
  { to: '/materials', icon: '📚', label: '素材库' },
  { to: '/tags', icon: '🏷️', label: '标签中心' },
  { to: '/search', icon: '🔎', label: '全局搜索' },
  { to: '/todos', icon: '✅', label: '待办总览' },
  { to: '/habits', icon: '🔥', label: '习惯打卡' },
  { to: '/fitness', icon: '🏋️', label: '运动健身' },
  { to: '/goals', icon: '🎯', label: '目标管理' },
  { to: '/wheel', icon: '🎡', label: '工具转盘' },
];
</script>

<template>
  <aside class="sidebar" aria-label="主导航">
    <RouterLink class="app-brand" to="/" aria-label="返回迁移总览">
      <h2>人生规划系统</h2>
    </RouterLink>

    <nav class="nav-list" aria-label="功能导航">
      <RouterLink
        v-for="item in navigation"
        :key="item.to"
        v-slot="{ href, isActive, navigate }"
        :to="item.to"
        custom
      >
        <a :class="['nav-item', { active: isActive }]" :href="href" @click="navigate">
          <span aria-hidden="true">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </a>
      </RouterLink>
    </nav>

    <div class="sidebar-primary-action">
      <RouterLink class="btn btn-secondary" to="/">迁移第 0 步</RouterLink>
    </div>
  </aside>
</template>
