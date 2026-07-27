<script setup lang="ts">
import { onBeforeMount } from 'vue';
import AppSidebar from './components/AppSidebar.vue';
import { useLifePlanStore } from './stores/lifePlanStore';

const lifePlan = useLifePlanStore();
onBeforeMount(() => lifePlan.load());
</script>

<template>
  <div class="vue-app-shell">
    <AppSidebar />
    <main class="main vue-main" aria-live="polite">
      <RouterView />
    </main>
  </div>
</template>
