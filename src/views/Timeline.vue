<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { annualSchedule } from '../data/policies.js'

const months = ['1月', '2-3月', '4月', '5月', '6月', '7-8月', '9月', '10月', '11月', '12月']
const activeMonth = ref('')
const scrolled = ref(false)

const today = new Date()
const nowMonth = today.getMonth() + 1

function monthRange(month) {
  return month.replace('月', '').split('-').map(Number)
}

function isNow(month) {
  const range = monthRange(month)
  if (range.length === 2) return nowMonth >= range[0] && nowMonth <= range[1]
  return nowMonth === range[0]
}

function seasonOf(month) {
  const range = monthRange(month)
  const m = range[range.length - 1]
  if (m >= 3 && m <= 5) return { key: 'spring', label: '春季', color: 'var(--green)' }
  if (m >= 6 && m <= 8) return { key: 'summer', label: '夏季', color: 'var(--orange)' }
  if (m >= 9 && m <= 11) return { key: 'autumn', label: '秋季', color: 'var(--yellow)' }
  return { key: 'winter', label: '冬季', color: 'var(--blue)' }
}

function scrollToMonth(month) {
  activeMonth.value = month
  const el = document.getElementById('month-' + month.replace('-', '').replace('月', ''))
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY - 96
    window.scrollTo({ top, behavior: 'smooth' })
  }
}

const isWarn = (ev) => !!(ev.desc && (ev.desc.includes('⚠️') || ev.desc.includes('关键')))

let onScroll = null
onMounted(() => {
  onScroll = () => { scrolled.value = window.scrollY > 36 }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  if (onScroll) window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div>
    <header class="nav-bar" :class="{ 'is-solid': scrolled }">
      <div class="nav-title" :class="{ visible: scrolled }">全年日程</div>
    </header>

    <div class="large-title">
      <h1>全年日程</h1>
      <div class="sub">1月到12月，资助工作不中断</div>
    </div>

    <div class="month-bar">
      <div class="chip-scroll">
        <button
          v-for="m in months"
          :key="m"
          class="chip chip--month"
          :aria-pressed="activeMonth === m"
          @click="scrollToMonth(m)"
        >
          {{ m }}
          <span v-if="isNow(m)" class="now-dot"></span>
        </button>
      </div>
    </div>

    <div class="group-header">共 {{ annualSchedule.length }} 个月段</div>

    <template v-for="(mc, i) in annualSchedule" :key="i">
      <div
        class="month-head"
        :id="'month-' + mc.month.replace('-', '').replace('月', '')"
      >
        <span class="season-dot" :style="{ background: seasonOf(mc.month).color }"></span>
        <span class="month-name">{{ mc.month }}</span>
        <span class="season-name">{{ seasonOf(mc.month).label }}</span>
        <span v-if="isNow(mc.month)" class="badge badge--national now-badge">本月</span>
        <span class="month-count">{{ mc.events.length }}</span>
      </div>

      <div class="group">
        <div v-for="(ev, j) in mc.events" :key="j" class="cell cell--event">
          <span class="ev-dot" :class="{ 'is-warn': isWarn(ev) }"></span>
          <span class="cell-body">
            <span class="ev-title">{{ ev.title }}</span>
            <span v-if="ev.desc" class="cell-subtitle cell-subtitle--wrap">{{ ev.desc }}</span>
          </span>
        </div>
      </div>
    </template>

    <div class="group-footer">
      红点标记公示类关键节点。具体日期以学校当年通知为准。
    </div>

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

.month-bar {
  position: sticky;
  top: calc(44px + var(--safe-top));
  z-index: 90;
  padding-top: 4px;
  background: var(--bar-bg);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 0.5px solid var(--bar-border);
}

.chip--month {
  height: 30px;
  padding: 0 13px;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.now-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--blue);
}

.chip[aria-pressed="true"] .now-dot {
  background: #fff;
}

.month-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 var(--gutter);
  padding: 14px 4px 7px;
  scroll-margin-top: 100px;
}

.season-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.month-name {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.2px;
}

.season-name {
  font-size: 12px;
  color: var(--label-3);
}

.now-badge {
  margin-left: 2px;
}

.month-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--label-3);
  font-variant-numeric: tabular-nums;
}

.cell--event {
  align-items: flex-start;
}

.ev-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--blue);
}

.ev-dot.is-warn {
  background: var(--red);
  box-shadow: 0 0 0 3px var(--red-tint);
}

.ev-title {
  display: block;
  font-size: 15.5px;
  line-height: 1.35;
  letter-spacing: -0.15px;
}
</style>
