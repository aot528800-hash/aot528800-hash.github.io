import { createApp } from 'vue'
import { App as CapacitorApp } from '@capacitor/app'
import App from './App.vue'
import router from './router'
import './assets/main.css'

createApp(App).use(router).mount('#app')

/*
 * 桌面长按图标的快捷方式（以及将来可能的深链）。
 * 约定：com.cqvie.aid://timeline / com.cqvie.aid://search
 */
function handleDeepLink(rawUrl) {
  if (!rawUrl) return
  const path = String(rawUrl)
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^\/+|\/+$/g, '')

  router.isReady().then(() => {
    if (path.startsWith('timeline')) router.push('/timeline')
    else if (path.startsWith('search')) router.push({ path: '/', query: { focus: 'search' } })
  })
}

// 冷启动：从快捷方式打开时，启动 Intent 里带着 url
CapacitorApp.getLaunchUrl()
  .then((res) => {
    if (res && res.url) handleDeepLink(res.url)
  })
  .catch(() => {})

// 热启动：应用已在后台，再从快捷方式进入
CapacitorApp.addListener('appUrlOpen', (event) => handleDeepLink(event.url))

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
