<script setup>
</script>

<template>
  <div id="app-container">
    <router-view v-slot="{ Component }">
      <transition name="page-fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <nav class="bottom-nav">
      <router-link to="/" class="nav-item" active-class="nav-active">
        <span class="nav-icon">🏠</span>
        <span class="nav-label">首页</span>
      </router-link>
      <router-link to="/timeline" class="nav-item" active-class="nav-active">
        <span class="nav-icon">📅</span>
        <span class="nav-label">全年日程</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
#app-container {
  padding-bottom: 70px;
  min-height: 100vh;
  background: #f5f7fa;
}
.bottom-nav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 60px;
  background: #fff;
  border-top: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 100;
  padding-bottom: var(--safe-bottom, env(safe-area-inset-bottom, 0));
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-decoration: none;
  color: #888;
  font-size: 11px;
  padding: 6px 20px;
  border-radius: 8px;
  transition: all 0.2s;
}
.nav-active {
  color: #1a73e8;
}
.nav-active .nav-icon {
  transform: scale(1.15);
}
.nav-icon {
  font-size: 22px;
  transition: transform 0.2s;
}
</style>
