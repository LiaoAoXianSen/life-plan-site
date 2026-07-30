<script setup lang="ts">
import { onBeforeMount } from 'vue';

import AppSidebar from './components/AppSidebar.vue';
import { bindMainCloudSync, startMainAutoSyncEngine } from './services/mainCloudSync';
import { useLifePlanStore } from './stores/lifePlanStore';

const lifePlan = useLifePlanStore();

onBeforeMount(() => {
  lifePlan.load();
  bindMainCloudSync({
    getData: () => lifePlan.data,
    replaceData: (next, reason) => lifePlan.replace(next, reason, 'sync'),
  });
  // Engine covers 20s dirty debounce (via store commits), 5-minute visible interval,
  // and visibility-resume. Avoid an unconditional startup both-sync here so
  // module remote contract tests can own window.fetch without a raced main GET.
  startMainAutoSyncEngine();
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
