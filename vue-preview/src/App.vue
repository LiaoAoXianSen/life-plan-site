<script setup lang="ts">
import { computed, ref } from 'vue';

const storageCheck = ref('checking');
const storageSample = ref('');

try {
  const key = 'life-plan-vue-preview-check';
  const value = new Date().toISOString();
  localStorage.setItem(key, value);
  storageSample.value = localStorage.getItem(key) || '';
  storageCheck.value = 'available';
} catch {
  storageCheck.value = 'unavailable';
}

const storageLabel = computed(() => {
  if (storageCheck.value === 'available') return 'localStorage 可用';
  if (storageCheck.value === 'unavailable') return 'localStorage 不可用';
  return '正在检查 localStorage';
});

const checks = [
  'Vue 组件正常渲染',
  'Vite build 可生成 dist 静态文件',
  'Cloudflare Pages 可单独部署 vue-preview 目录',
  '当前正式版 index.html / app.js 不受影响',
];
</script>

<template>
  <main class="preview-shell">
    <section class="preview-card">
      <div class="preview-kicker">Vue Preview POC</div>
      <h1>人生规划系统 · 框架部署小实验</h1>
      <p class="preview-copy">
        这是一个完全隔离的 Vite + Vue 3 + TypeScript 预览页，用来验证 GitHub 分支到 Cloudflare Pages 的构建部署链路。
      </p>

      <div class="status-row">
        <span class="status-dot" aria-hidden="true"></span>
        <strong>{{ storageLabel }}</strong>
        <small v-if="storageSample">写入时间：{{ storageSample }}</small>
      </div>

      <div class="check-grid">
        <article v-for="item in checks" :key="item" class="check-card">
          <span>✓</span>
          <p>{{ item }}</p>
        </article>
      </div>

      <footer class="preview-note">
        正式静态版仍然部署 master；这个页面建议用 Cloudflare Pages 独立项目部署 experiment/vue-preview-poc 分支。
      </footer>
    </section>
  </main>
</template>
