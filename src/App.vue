<script setup lang="ts">
import AppSidebar from './components/AppSidebar.vue';
</script>

<template>
  <div class="vue-app-shell">
    <AppSidebar />
    <main class="main vue-main" aria-live="polite">
      <RouterView />
    </main>
  </div>
</template>
