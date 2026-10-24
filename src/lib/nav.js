import { ref } from 'vue'
import { policyCategories } from '../data/policies.js'

/** 上一个页面，用于 iOS 式「返回按钮显示上一屏标题」 */
export const previousRoute = ref(null)

export function routeTitle(route) {
  if (!route) return ''
  if (route.path === '/') return '首页'
  if (route.path === '/timeline') return '全年日程'
  if (String(route.path).startsWith('/policy/')) {
    const p = policyCategories.find((x) => x.id === route.params?.id)
    return p ? p.title : '返回'
  }
  return '返回'
}

/**
 * iOS 的做法：返回按钮显示上一屏标题，但标题过长时会退化成通用的「返回」，
 * 而不是挤占居中标题的位置。这里按字数截断（4 个字以内保留原名）。
 */
export function backLabel(maxChars = 4, fallback = '返回') {
  const title = previousRoute.value?.title || '首页'
  return title.length > maxChars ? fallback : title
}
