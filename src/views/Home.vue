<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { policyCategories } from '../data/policies.js'
import { searchPolicies } from '../lib/policy.js'

const router = useRouter()
const query = ref('')
const scrolled = ref(false)
const appVersion = __APP_VERSION__

/* 搜索词跨页面保留：从详情页返回时仍停在结果列表上 */
const SEARCH_KEY = 'aid_search_query'
try {
  query.value = sessionStorage.getItem(SEARCH_KEY) || ''
} catch {
  query.value = ''
}
watch(query, (v) => {
  try {
    if (v) sessionStorage.setItem(SEARCH_KEY, v)
    else sessionStorage.removeItem(SEARCH_KEY)
  } catch {
    /* 隐私模式忽略 */
  }
})

const national = computed(() => policyCategories.filter((p) => p.tag === '国家政策'))
const school = computed(() => policyCategories.filter((p) => p.tag === '校内政策'))

const stats = computed(() => {
  const levels = policyCategories.map((p) => p.approvalChain?.length || 0)
  return {
    count: policyCategories.length,
    maxLevel: Math.max(...levels),
    docs: new Set(policyCategories.map((p) => p.source).filter(Boolean)).size,
  }
})

const goTo = (id) => router.push('/policy/' + id)

/* 搜索：标题 / 副标题 / 简介 / 标签 + 常用简称（逻辑见 src/lib/policy.js） */
const results = computed(() => searchPolicies(policyCategories, query.value))

const tint = (hex) => (hex || '#8e8e93') + '24'

let onScroll = null

/* 返回键：搜索状态下先清空搜索，而不是直接退出应用 */
function onAppBack(e) {
  if (query.value) {
    e.preventDefault()
    query.value = ''
  }
}

onMounted(() => {
  onScroll = () => {
    scrolled.value = window.scrollY > 36
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('app:back', onAppBack)
  onScroll()
})

onBeforeUnmount(() => {
  if (onScroll) window.removeEventListener('scroll', onScroll)
  window.removeEventListener('app:back', onAppBack)
})
</script>

<template>
  <div>
    <header class="nav-bar" :class="{ 'is-solid': scrolled }">
      <div class="nav-title" :class="{ visible: scrolled }">资助通</div>
    </header>

    <div class="large-title">
      <h1>资助通</h1>
      <div class="sub">重庆工程职业技术大学 · 学生资助政策</div>
    </div>

    <div class="search">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.6-3.6" />
      </svg>
      <input v-model="query" class="search-input" type="search" enterkeyhint="search"
        placeholder="搜索项目、金额、条件" aria-label="搜索资助政策" />
      <button v-if="query" class="search-clear" aria-label="清除" @click="query = ''">✕</button>
    </div>

    <template v-if="!query">
      <div class="group stat-group">
        <div class="stat-strip">
          <div class="stat">
            <div class="stat-value">{{ stats.count }}</div>
            <div class="stat-label">资助项目</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ stats.maxLevel }}</div>
            <div class="stat-label">最高审批层级</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ stats.docs }}</div>
            <div class="stat-label">政策依据文件</div>
          </div>
        </div>
      </div>

      <div class="group-header">国家政策</div>
      <div class="group">
        <button
          v-for="cat in national"
          :key="cat.id"
          class="cell cell--tappable cell--policy"
          @click="goTo(cat.id)"
        >
          <span class="tile" :style="{ background: tint(cat.color) }">{{ cat.icon }}</span>
          <span class="cell-body">
            <span class="cell-title">{{ cat.title }}</span>
            <span class="cell-subtitle">{{ cat.subtitle }}</span>
          </span>
          <svg class="chev" viewBox="0 0 8 13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1.5 1.5 6 6.5l-4.5 5" />
          </svg>
        </button>
      </div>

      <div class="group-header">校内政策</div>
      <div class="group">
        <button
          v-for="cat in school"
          :key="cat.id"
          class="cell cell--tappable cell--policy"
          @click="goTo(cat.id)"
        >
          <span class="tile" :style="{ background: tint(cat.color) }">{{ cat.icon }}</span>
          <span class="cell-body">
            <span class="cell-title">{{ cat.title }}</span>
            <span class="cell-subtitle">{{ cat.subtitle }}</span>
          </span>
          <svg class="chev" viewBox="0 0 8 13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1.5 1.5 6 6.5l-4.5 5" />
          </svg>
        </button>
      </div>

      <div class="group-header">关于</div>
      <div class="group">
        <a class="cell cell--tappable" href="tel:02361065934">
          <span class="tile" style="background: var(--green-tint)">📞</span>
          <span class="cell-body">
            <span class="cell-title">学生资助管理中心</span>
            <span class="cell-subtitle">政策疑问、申请受阻，直接打电话</span>
          </span>
          <span class="cell-detail cell-detail--accent">拨号</span>
        </a>
        <div class="cell">
          <span class="tile" style="background: var(--blue-tint)">💬</span>
          <span class="cell-body">
            <span class="cell-title">微信公众号</span>
            <span class="cell-subtitle">停不下来的独行侠 · 政策咨询与材料指导</span>
          </span>
        </div>
        <div class="cell">
          <span class="tile" style="background: var(--gray-tint)">ⓘ</span>
          <span class="cell-body">
            <span class="cell-title">版本</span>
            <span class="cell-subtitle">v{{ appVersion }} · 个人独立开发，非官方产品</span>
          </span>
        </div>
      </div>

      <div class="group-footer">
        本应用非重庆工程职业技术大学官方产品，仅供信息参考，不构成政策承诺或法律依据。
        具体政策、条件与金额以学校学生资助管理中心当年通知为准。
      </div>
    </template>

    <template v-else>
      <div class="group-header">搜索结果 · {{ results.length }}</div>
      <div v-if="results.length" class="group">
        <button
          v-for="cat in results"
          :key="cat.id"
          class="cell cell--tappable cell--policy"
          @click="goTo(cat.id)"
        >
          <span class="tile" :style="{ background: tint(cat.color) }">{{ cat.icon }}</span>
          <span class="cell-body">
            <span class="cell-title">{{ cat.title }}</span>
            <span class="cell-subtitle">{{ cat.subtitle }}</span>
          </span>
          <span class="badge" :class="cat.tag === '国家政策' ? 'badge--national' : 'badge--school'">
            {{ cat.tag === '国家政策' ? '国家' : '校内' }}
          </span>
        </button>
      </div>
      <div v-else class="empty">
        没有找到「{{ query }}」<br />试试「国奖」「贷款」「勤工」「退役」
      </div>
    </template>

    <div class="push-bottom"></div>
  </div>
</template>

<style scoped>
.nav-bar {
  background: transparent;
  border-bottom-color: transparent;
  transition: background 0.25s linear, border-color 0.25s linear;
}

.nav-bar.is-solid {
  background: var(--bar-bg);
  border-bottom-color: var(--bar-border);
}

.nav-title {
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.2s linear, transform 0.2s var(--ease-ios);
}

.nav-title.visible {
  opacity: 1;
  transform: none;
}

.stat-group {
  margin-top: 2px;
}

.stat-value {
  color: var(--label);
}
</style>
