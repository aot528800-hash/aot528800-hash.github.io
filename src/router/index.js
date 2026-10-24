import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import PolicyDetail from '../views/PolicyDetail.vue'
import Timeline from '../views/Timeline.vue'
import Privacy from '../views/Privacy.vue'
import { previousRoute, routeTitle } from '../lib/nav.js'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/policy/:id', name: 'PolicyDetail', component: PolicyDetail, props: true },
  { path: '/timeline', name: 'Timeline', component: Timeline },
  { path: '/privacy', name: 'Privacy', component: Privacy },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  // 返回时恢复到离开时的位置，其余导航回到顶部
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      /*
       * 页面转场是 out-in：新视图挂载前，文档高度还是旧页面的，
       * 立刻恢复会被截断到旧页面的最大滚动距离。等转场结束再滚。
       */
      return new Promise((resolve) => {
        setTimeout(() => resolve(savedPosition), 320)
      })
    }
    return { top: 0 }
  },
})

// 记录来源页面，供 iOS 式返回按钮显示上一屏标题
router.afterEach((to, from) => {
  if (from && from.path && from.path !== to.path) {
    previousRoute.value = { path: from.path, title: routeTitle(from) }
  }
})

export default router
