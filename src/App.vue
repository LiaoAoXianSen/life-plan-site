<script setup lang="ts">
import { onBeforeMount, onMounted } from 'vue';

import AppSidebar from './components/AppSidebar.vue';
import { bindHabitCloudSync, startHabitAutoSyncEngine } from './services/habitCloudSync';
import { bindMainCloudSync, runMainCloudSyncBoth, startMainAutoSyncEngine } from './services/mainCloudSync';
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
  startMainAutoSyncEngine();
  startTodoAutoSyncEngine();
  startWheelAutoSyncEngine();
  startHabitAutoSyncEngine();
});

onMounted(() => {
  // Match the legacy boot flow: a configured app checks both local and cloud data immediately.
  void runMainCloudSyncBoth({ source: 'startup-auto-sync' }).catch(() => undefined);
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
