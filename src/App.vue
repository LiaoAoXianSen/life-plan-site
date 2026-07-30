<script setup lang="ts">
import { onBeforeMount } from 'vue';

import AppSidebar from './components/AppSidebar.vue';
import { bindHabitCloudSync, startHabitAutoSyncEngine } from './services/habitCloudSync';
import { bindMainCloudSync, startMainAutoSyncEngine } from './services/mainCloudSync';
import { bindTodoCloudSync, startTodoAutoSyncEngine } from './services/todoCloudSync';
import { bindWheelCloudSync, startWheelAutoSyncEngine } from './services/wheelCloudSync';
import { useLifePlanStore } from './stores/lifePlanStore';

const lifePlan = useLifePlanStore();

onBeforeMount(() => {
  lifePlan.load();
  bindMainCloudSync({
    getData: () => lifePlan.data,
    replaceData: (next, reason) => lifePlan.replace(next, reason, 'sync'),
  });
  bindWheelCloudSync({
    getData: () => lifePlan.data,
    replaceData: (next, reason) => lifePlan.replace(next, reason, 'user'),
  });
  bindTodoCloudSync({
    getData: () => lifePlan.data,
    replaceData: (next, reason) => lifePlan.replace(next, reason, 'user'),
  });
  bindHabitCloudSync({
    getData: () => lifePlan.data,
    replaceData: (next, reason) => lifePlan.replace(next, reason, 'user'),
  });
  // Engine covers 20s dirty debounce (via store commits), 5-minute visible interval,
  // and visibility-resume. Avoid an unconditional startup both-sync here so
  // module remote contract tests can own window.fetch without a raced main GET.
  startMainAutoSyncEngine();
  startTodoAutoSyncEngine();
  startWheelAutoSyncEngine();
  startHabitAutoSyncEngine();
});
</script>

<template>
  <div class="vue-app-shell">
    <AppSidebar />
    <main class="main vue-main" aria-live="polite">
      <RouterView />
    </main>
  </div>
</template>
