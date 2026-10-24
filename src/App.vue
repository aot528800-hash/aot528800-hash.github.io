<script setup>
</script>

<template>
  <div class="app-shell">
    <router-view v-slot="{ Component }">
      <transition name="page-slide" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

    <nav class="tabbar" role="tablist" aria-label="主导航">
      <router-link to="/" class="tab-item" active-class="active" aria-label="政策首页">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true">
          <path d="M3.5 10.6 12 3.8l8.5 6.8V20a1 1 0 0 1-1 1h-4.8v-6.2H9.3V21H4.5a1 1 0 0 1-1-1z" />
        </svg>
        <span>首页</span>
      </router-link>
      <router-link to="/timeline" class="tab-item" active-class="active" aria-label="全年日程">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true">
          <rect x="3.6" y="5.4" width="16.8" height="15" rx="2.6" />
          <path d="M8.2 3v4.2M15.8 3v4.2M3.6 10.4h16.8" />
        </svg>
        <span>全年日程</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  padding-bottom: calc(49px + var(--safe-bottom));
  background: var(--bg);
}
</style>
