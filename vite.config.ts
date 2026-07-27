import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // Relative asset paths keep a branch preview deployable from Cloudflare Pages.
  base: './',
  plugins: [vue()],
});
