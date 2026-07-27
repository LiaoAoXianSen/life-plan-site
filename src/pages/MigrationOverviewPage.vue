<template>
  <section class="page active migration-page">
    <header class="page-header">
      <div>
        <p class="migration-kicker">Vite · Vue 3 · TypeScript</p>
        <h1 class="page-title">正式迁移壳已就绪</h1>
      </div>
      <span class="migration-stage">第 0 步</span>
    </header>

    <article class="card migration-card">
      <h2 class="card-title">本阶段范围</h2>
      <p>
        已建立 Vite、Vue Router（hash mode）和 Pinia 的基础结构。本页不读取、不写入现有
        localStorage，也没有接入同步、快照或业务服务。
      </p>
    </article>

    <div class="migration-grid">
      <article class="card">
        <h2 class="card-title">保留不动</h2>
        <ul>
          <li>现有数据结构与 localStorage key</li>
          <li>WebDAV 路径、导入导出、快照和合并规则</li>
          <li>同步、记录、待办、习惯等根目录服务文件</li>
        </ul>
      </article>
      <article class="card">
        <h2 class="card-title">下一阶段</h2>
        <p>第 1 步将单独迁移只读的首页仪表盘，并在完成后再次构建验证。</p>
      </article>
    </div>
  </section>
</template>
