<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { annualSchedule } from '../data/policies.js'
import centerData from '../data/center.json'

const months = ['1月', '2-3月', '4月', '5月', '6月', '7-8月', '9月', '10月', '11月', '12月']

/* ---------- 视角：学生 / 工作 ---------- */
const VIEW_KEY = 'aid_timeline_view'
const view = ref('student')

function setView(v) {
  view.value = v
  try { localStorage.setItem(VIEW_KEY, v) } catch {}
}

/* 资助中心全年节奏（业务总表第 3 页） */
const RHYTHM = (() => {
  const keys = Object.keys(centerData)
  const sheet = centerData[keys[2]] || []
  return sheet.slice(2).filter((r) => r[0] && !String(r[0]).startsWith('说明'))
})()

const MONTH_BUCKET = {
  1: '1月', 2: '2-3月', 3: '2-3月', 4: '4月', 5: '5月', 6: '6月',
  7: '7-8月', 8: '7-8月', 9: '9月', 10: '10月', 11: '11月', 12: '12月',
}

function monthBuckets(label) {
  const t = String(label)
  if (/暑期|暑假/.test(t) && !/\d/.test(t)) return ['7-8月']
  const nums = [...new Set([...t.matchAll(/(\d{1,2})/g)].map((m) => Number(m[1])).filter((n) => n >= 1 && n <= 12))]
  return [...new Set(nums.map((n) => MONTH_BUCKET[n]))]
}

// 属于「常态」而非具体月份的经办事项
const ROUTINE_KEYWORDS = /每月|每学期|随时|常态|按需|动态/

const staffByBucket = {}
for (const r of RHYTHM) {
  const title = r[1]
  const cat = r[2] || ''
  const note = r[3] || ''
  if (ROUTINE_KEYWORDS.test(String(r[0]))) continue
  for (const b of monthBuckets(r[0])) {
    ;(staffByBucket[b] = staffByBucket[b] || []).push({ title, desc: note || cat, source: 'staff' })
  }
}

const routine = RHYTHM.filter((r) => ROUTINE_KEYWORDS.test(String(r[0])))
  .map((r) => ({ title: r[1], note: r[3] || r[2] || '' }))

const studentRows = annualSchedule.map((m) => ({
  month: m.month,
  events: m.events.map((e) => ({ ...e, source: 'student' })),
}))

const workRows = annualSchedule.map((m) => ({
  month: m.month,
  events: [
    ...(staffByBucket[m.month] || []),
    ...m.events.map((e) => ({ ...e, source: 'student' })),
  ],
}))

const rows = computed(() => (view.value === 'work' ? workRows : studentRows))

// 中心经办任务去重计数（同一任务可能跨两个月）
const staffTasks = new Set(RHYTHM.filter((r) => !ROUTINE_KEYWORDS.test(String(r[0]))).map((r) => r[1])).size
const studentNodes = annualSchedule.reduce((n, m) => n + m.events.length, 0)
const peak = workRows.reduce((a, b) => (b.events.length > a.events.length ? b : a), workRows[0])
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

function stickyOffset() {
  const nav = document.querySelector('.nav-bar')
  const bar = document.querySelector('.month-bar')
  const navH = nav ? nav.getBoundingClientRect().height : 44
  const barH = bar ? bar.getBoundingClientRect().height : 46
  return navH + barH + 8
}

function scrollToMonth(month) {
  activeMonth.value = month
  const el = document.getElementById('month-' + month.replace('-', '').replace('月', ''))
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset()
    window.scrollTo({ top, behavior: 'smooth' })
  }
}

const isWarn = (ev) => !!(ev.desc && (ev.desc.includes('⚠️') || ev.desc.includes('关键')))

let onScroll = null
onMounted(() => {
  try {
    const saved = localStorage.getItem(VIEW_KEY)
    if (saved === 'work' || saved === 'student') view.value = saved
  } catch {}

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

    <div class="view-switch">
      <div class="seg" role="group" aria-label="查看视角">
        <button :class="{ on: view === 'student' }" :aria-pressed="view === 'student'" @click="setView('student')">学生视角</button>
        <button :class="{ on: view === 'work' }" :aria-pressed="view === 'work'" @click="setView('work')">工作视角</button>
      </div>
    </div>

    <div v-if="view === 'work'" class="work-summary">
      全年 {{ staffTasks }} 项中心经办任务、{{ studentNodes }} 个学生申请节点；
      最忙的是 <strong>{{ peak.month }}</strong>（{{ peak.events.length }} 项），另有 {{ routine.length }} 项常态业务每月运行。
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

    <div class="group-header">
      {{ view === 'student' ? `共 ${annualSchedule.length} 个月段` : `共 ${rows.length} 个月段 · 学生与中心并列` }}
    </div>

    <template v-for="(mc, i) in rows" :key="i">
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
          <span class="ev-dot" :class="{ 'is-warn': isWarn(ev), 'is-staff': view === 'work' && ev.source === 'staff' }"></span>
          <span class="cell-body">
            <span class="ev-title">
              <span v-if="view === 'work'" class="src-tag" :class="ev.source">{{ ev.source === 'staff' ? '中心' : '学生' }}</span>
              {{ ev.title }}
            </span>
            <span v-if="ev.desc" class="cell-subtitle cell-subtitle--wrap">{{ ev.desc }}</span>
          </span>
        </div>
      </div>
    </template>

    <template v-if="view === 'work' && routine.length">
      <div class="group-header">常规经办 · 每月都在跑</div>
      <div class="group">
        <div v-for="(r, i) in routine" :key="i" class="cell cell--event">
          <span class="ev-dot is-staff"></span>
          <span class="cell-body">
            <span class="ev-title">{{ r.title }}</span>
            <span v-if="r.note" class="cell-subtitle cell-subtitle--wrap">{{ r.note }}</span>
          </span>
        </div>
      </div>
    </template>

    <div class="group-footer">
      {{ view === 'work' ? '「中心」为资助中心经办事项，「学生」为学生申请节点；红点标记公示类关键节点。' : '红点标记公示类关键节点。具体日期以学校当年通知为准。' }}
    </div>

    <div class="push-bottom"></div>
  </div>
</template>

<style scoped>
.view-switch {
  padding: 4px 16px 10px;
  display: flex;
  justify-content: flex-start;
}

.seg {
  display: flex;
  padding: 3px;
  background: var(--bg-fill);
  border-radius: 10px;
}

.seg button {
  min-width: 78px;
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--label-2);
  transition: background 0.18s var(--ease-ios), color 0.18s linear;
}

.seg button.on {
  background: var(--bg-elevated);
  color: var(--label);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.work-summary {
  margin: 0 16px 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg-fill);
  font-size: 13px;
  line-height: 1.6;
  color: var(--label-2);
}

.work-summary strong {
  color: var(--label);
}

.src-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: 5px;
  font-size: 10.5px;
  font-weight: 600;
  vertical-align: 1px;
}

.src-tag.staff {
  color: #b25000;
  background: rgba(255, 149, 0, 0.16);
}

.src-tag.student {
  color: var(--label-3);
  background: var(--bg-fill);
}

.ev-dot.is-staff {
  background: var(--orange, #ff9500);
}

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
