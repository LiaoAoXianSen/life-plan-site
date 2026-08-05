<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import PageHeader from '../components/common/PageHeader.vue';

const route = useRoute();
const title = computed(() => String(route.meta.title ?? '功能页面'));
const phase = computed(() => String(route.meta.phase ?? '后续阶段'));
</script>

<template>
  <section class="page active migration-page">
    <PageHeader :title="title" title-as="h1">
      <template #pretitle><p class="migration-kicker">{{ phase }}</p></template>
    </PageHeader>

    <article class="card migration-card">
      <h2 class="card-title">尚未迁移</h2>
      <p>当前路由用于验证应用壳与导航；该模块的业务逻辑、数据读写和原有服务将在对应阶段单独迁移。</p>
    </article>
  </section>
</template>
