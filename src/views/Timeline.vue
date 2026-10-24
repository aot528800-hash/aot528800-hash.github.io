<script setup>
import { ref } from 'vue'
import { annualSchedule } from '../data/policies.js'

const months = ['1月','2-3月','4月','5月','6月','7-8月','9月','10月','11月','12月']
const activeMonth = ref('')

function scrollToMonth(month) {
  activeMonth.value = month
  const el = document.getElementById('month-' + month.replace('-', '').replace('月', ''))
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function monthClass(month) {
  const parts = month.replace('月','').split('-')
  const m = parseInt(parts[parts.length - 1])
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1>📅 全年资助工作日程</h1>
      <div class="subtitle">1月到12月，资助工作不中断</div>
    </div>

    <!-- Month selector -->
    <div class="month-selector">
      <button
        v-for="m in months" :key="m"
        class="month-btn"
        :class="{ 'month-btn-active': activeMonth === m }"
        @click="scrollToMonth(m)"
      >{{ m }}</button>
    </div>

    <!-- Key notice -->
    <div style="padding: 4px 16px 8px;">
      <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:8px 12px;font-size:12px;color:#856404;">
        ⚠️ 红色圆点标记关键公示节点 · 具体日期以学校当年通知为准
      </div>
    </div>

    <!-- Month cards -->
    <div class="annual-timeline">
      <div v-for="(mc, i) in annualSchedule" :key="i" class="month-card" :id="'month-' + mc.month.replace('-', '').replace('月', '')">
        <div class="month-header" :class="monthClass(mc.month)">{{ mc.month }}</div>
        <div class="month-events">
          <div v-for="(ev, j) in mc.events" :key="j" class="month-event">
            <div class="event-dot" :class="{ 'event-warn': ev.desc && (ev.desc.includes('⚠️') || ev.desc.includes('关键')) }"></div>
            <div class="event-info">
              <h4>{{ ev.title }}</h4>
              <p v-if="ev.desc">{{ ev.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div style="height:20px;"></div>
  </div>
</template>

<style scoped>
.month-selector {
  display: flex;
  gap: 6px;
  padding: 10px 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}
.month-selector::-webkit-scrollbar { display: none; }
.month-btn {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 16px;
  border: 1.5px solid #e0e0e0;
  background: #fff;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.month-btn:active { transform: scale(0.95); }
.month-btn-active {
  border-color: #1a73e8;
  background: #e8f0fe;
  color: #1a73e8;
  font-weight: 600;
}
</style>
