import { createApp } from 'vue'
import { App as CapacitorApp } from '@capacitor/app'
import App from './App.vue'
import router from './router'
import './assets/main.css'

createApp(App).use(router).mount('#app')

/*
 * Android 返回键（含手势返回）。
 * Capacitor 8 的 Android 侧没有任何 onBackPressed 实现，不注册这个监听器时，
 * 按返回键会直接退出应用。
 * 规则：详情页回上一页 → 其它页回首页 → 首页才退出。
 */
CapacitorApp.addListener('backButton', () => {
  const route = router.currentRoute.value

  if (route.path.startsWith('/policy/')) {
    if (window.history.state && window.history.state.back) router.back()
    else router.replace('/')
    return
  }

  if (route.path !== '/') {
    router.replace('/')
    return
  }

  // 首页还有可撤回的界面状态（如搜索结果）时，先交给页面处理，不退出
  const evt = new CustomEvent('app:back', { cancelable: true })
  const consumed = !window.dispatchEvent(evt)
  if (!consumed) CapacitorApp.exitApp()
})
