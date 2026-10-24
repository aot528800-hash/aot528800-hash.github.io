import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import PolicyDetail from '../views/PolicyDetail.vue'
import Timeline from '../views/Timeline.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/policy/:id', name: 'PolicyDetail', component: PolicyDetail, props: true },
  { path: '/timeline', name: 'Timeline', component: Timeline },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() { return { top: 0 } }
})

export default router
