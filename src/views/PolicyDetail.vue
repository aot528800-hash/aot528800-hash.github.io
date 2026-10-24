<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { policyCategories } from '../data/policies.js'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps({ id: String })
const router = useRouter()

const policy = computed(() => policyCategories.find((p) => p.id === props.id))

const tabs = [
  { key: 'overview', label: '总览' },
  { key: 'flow', label: '流程' },
  { key: 'timeline', label: '时间' },
  { key: 'materials', label: '材料' },
]

const activeTab = ref('overview')
const activeIndex = computed(() => tabs.findIndex((t) => t.key === activeTab.value))
const selectedRole = ref(0)
const showFullChain = ref(false)

/* ---------- 材料清单勾选（本地持久化） ---------- */
const STORAGE_PREFIX = 'aid_materials_'
const checkedMaterials = ref({})

function loadMaterials() {
  checkedMaterials.value = {}
  if (!policy.value) return
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + policy.value.id)
    if (saved) checkedMaterials.value = JSON.parse(saved)
  } catch {
    checkedMaterials.value = {}
  }
}

function saveMaterials() {
  if (!policy.value) return
  localStorage.setItem(STORAGE_PREFIX + policy.value.id, JSON.stringify(checkedMaterials.value))
}

function toggleMaterial(matId) {
  checkedMaterials.value[matId] = !checkedMaterials.value[matId]
  saveMaterials()
}

function clearMaterials() {
  checkedMaterials.value = {}
  saveMaterials()
}

const materialProgress = computed(() => {
  const list = policy.value?.materials || []
  const done = list.filter((m) => checkedMaterials.value[m.id]).length
  return { done, total: list.length }
})

/* ---------- 正文里的政策互链 ---------- */
const ALIAS_LINKS = {
  困难认定: 'difficulty-assessment',
  家庭经济困难: 'difficulty-assessment',
  国开行贷款: 'student-loan',
  校内奖学金: 'president-honor',
  基层就业: 'grassroots-compensation',
  服兵役: 'military-compensation',
  退役士兵: 'military-grant',
}

const linkMap = computed(() => {
  const map = {}
  policyCategories.forEach((p) => { map[p.title] = p.id })
  Object.entries(ALIAS_LINKS).forEach(([k, v]) => { map[k] = v })
  return map
})

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const linkRe = computed(() => {
  const terms = [...new Set([...policyCategories.map((p) => p.title), ...Object.keys(ALIAS_LINKS)])]
    .filter((t) => t && t.length >= 4)
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
  return new RegExp('(' + terms.join('|') + ')', 'g')
})

function segments(text) {
  return String(text || '').split(linkRe.value)
}

function linkFor(part) {
  return linkMap.value[part] || null
}

function goPolicy(pid) {
  if (pid) router.push('/policy/' + pid)
}

/* ---------- 时间节点类型 ---------- */
const TYPE_META = {
  notice: { label: '公告通知', color: 'var(--blue)' },
  student: { label: '学生行动', color: 'var(--orange)' },
  counselor: { label: '辅导员审核', color: 'var(--green)' },
  center: { label: '资助中心', color: 'var(--purple)' },
  publicity: { label: '公示节点', color: 'var(--red)' },
  leadership: { label: '领导小组', color: 'var(--indigo)' },
  all: { label: '全流程', color: 'var(--gray)' },
}
const typeMeta = (t) => TYPE_META[t] || { label: '节点', color: 'var(--gray)' }

/* ---------- 生命周期 ---------- */
function goBack() {
  if (window.history.length > 2) router.back()
  else router.push('/')
}

onMounted(() => {
  if (!policy.value) {
    router.replace('/')
    return
  }
  loadMaterials()
  window.scrollTo(0, 0)
})

watch(activeTab, () => { window.scrollTo(0, 0) })

watch(() => props.id, () => {
  if (!policyCategories.find((p) => p.id === props.id)) {
    router.replace('/')
    return
  }
  activeTab.value = 'overview'
  selectedRole.value = 0
  showFullChain.value = false
  loadMaterials()
  window.scrollTo(0, 0)
})

function renderMarkdown(text) {
  if (!text) return ''
  return DOMPurify.sanitize(marked.parse(text))
}

const tint = (hex) => (hex || '#8e8e93') + '24'
</script>

<template>
  <div v-if="policy">
    <header class="nav-bar">
      <button class="nav-back" aria-label="返回" @click="goBack">
        <span class="chev">‹</span><span>首页</span>
      </button>
      <div class="nav-title">{{ policy.title }}</div>
    </header>

    <div class="detail-head">
      <span class="tile tile--56" :style="{ background: tint(policy.color) }">{{ policy.icon }}</span>
      <div class="detail-head-body">
        <h1>{{ policy.title }}</h1>
        <p>{{ policy.subtitle }}</p>
        <div class="head-badges">
          <span class="badge" :class="policy.tag === '国家政策' ? 'badge--national' : 'badge--school'">
            {{ policy.tag }}
          </span>
          <span v-if="policy.source" class="badge badge--neutral">{{ policy.source }}</span>
        </div>
      </div>
    </div>

    <div class="seg-wrap">
      <div class="seg" role="tablist">
        <div
          class="seg-thumb"
          :style="{
            width: `calc((100% - 4px) / ${tabs.length})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }"
        ></div>
        <button
          v-for="t in tabs"
          :key="t.key"
          class="seg-btn"
          role="tab"
          :aria-selected="activeTab === t.key"
          @click="activeTab = t.key"
        >{{ t.label }}</button>
      </div>
    </div>

    <!-- ================= 总览 ================= -->
    <template v-if="activeTab === 'overview'">
      <template v-if="policy.rules">
        <div class="group-header">可以申请，如果</div>
        <div v-if="policy.rules.prerequisites?.length" class="group">
          <div v-for="(r, i) in policy.rules.prerequisites" :key="'p' + i" class="cell cell--wrap">
            <span class="mark mark--yes">✓</span>
            <span class="cell-body">
              <span class="cell-text">
                <template v-for="(part, pi) in segments(r)" :key="pi">
                  <a v-if="linkFor(part)" class="inline-link" @click.stop="goPolicy(linkFor(part))">{{ part }}</a>
                  <template v-else>{{ part }}</template>
                </template>
              </span>
            </span>
          </div>
        </div>

        <template v-if="[...(policy.rules.exclusions || []), ...(policy.rules.disqualifiers || [])].length">
          <div class="group-header">不能申请，如果</div>
          <div class="group">
            <div v-for="(r, i) in [...(policy.rules.exclusions || []), ...(policy.rules.disqualifiers || [])]"
              :key="'n' + i" class="cell cell--wrap">
              <span class="mark mark--no">✕</span>
              <span class="cell-body">
                <span class="cell-text">
                  <template v-for="(part, pi) in segments(r)" :key="pi">
                    <a v-if="linkFor(part)" class="inline-link" @click.stop="goPolicy(linkFor(part))">{{ part }}</a>
                    <template v-else>{{ part }}</template>
                  </template>
                </span>
              </span>
            </div>
          </div>
        </template>
        <div v-else class="group-footer">无特殊限制</div>
      </template>

      <div class="group-header">政策要点</div>
      <div class="group">
        <div class="md" v-html="renderMarkdown(policy.overview)"></div>
      </div>

      <div v-if="policy.source" class="group-footer">
        政策依据：{{ policy.source }}
      </div>
    </template>

    <!-- ================= 流程 ================= -->
    <template v-else-if="activeTab === 'flow'">
      <template v-if="policy.approvalChain?.length">
        <div class="group-header">选择你的角色</div>
        <div class="chip-scroll">
          <button
            v-for="(level, i) in policy.approvalChain"
            :key="i"
            class="chip"
            :aria-pressed="selectedRole === i"
            @click="selectedRole = i; showFullChain = false"
          >
            <span>{{ level.icon }}</span>
            <span>{{ level.role }}</span>
            <span class="chip-num">L{{ level.level }}</span>
          </button>
        </div>

        <div v-if="policy.approvalChain[selectedRole]" class="group role-card">
          <div class="cell">
            <span class="tile tile--44">{{ policy.approvalChain[selectedRole].icon }}</span>
            <span class="cell-body">
              <span class="cell-title">{{ policy.approvalChain[selectedRole].role }}</span>
              <span class="cell-subtitle">第 {{ policy.approvalChain[selectedRole].level }} 级审批 · 你在这里要做什么</span>
            </span>
          </div>
          <div v-for="(step, j) in policy.approvalChain[selectedRole].steps" :key="j" class="step-row">
            <span class="step-num">{{ j + 1 }}</span>
            <div>
              <div class="step-title">{{ step.title }}</div>
              <div class="step-desc">{{ step.desc }}</div>
            </div>
          </div>
          <div v-if="policy.approvalChain[selectedRole].publicity" class="publicity-note">
            <span>📣</span>
            <span>{{ policy.approvalChain[selectedRole].publicity }}</span>
          </div>
        </div>

        <div class="group">
          <button class="cell cell--tappable" @click="showFullChain = !showFullChain">
            <span class="tile" style="background: var(--gray-tint)">🔗</span>
            <span class="cell-body">
              <span class="cell-title">完整审批链</span>
              <span class="cell-subtitle">共 {{ policy.approvalChain.length }} 级，从学生到学校</span>
            </span>
            <span class="cell-detail">{{ showFullChain ? '收起' : '展开' }}</span>
          </button>

          <template v-if="showFullChain">
            <button
              v-for="(level, i) in policy.approvalChain"
              :key="'full' + i"
              class="cell cell--tappable"
              @click="selectedRole = i; showFullChain = false"
            >
              <span class="chain-dot" :class="{ 'is-active': i === selectedRole }">{{ level.level }}</span>
              <span class="cell-body">
                <span class="cell-title">{{ level.icon }} {{ level.role }}</span>
                <span class="cell-subtitle">
                  {{ level.steps.length }} 项任务{{ level.publicity ? ' · ' + level.publicity : '' }}
                </span>
              </span>
            </button>
          </template>
        </div>
      </template>
      <div v-else class="empty">该项暂无审批流程数据</div>
    </template>

    <!-- ================= 时间 ================= -->
    <template v-else-if="activeTab === 'timeline'">
      <div class="group-header">关键时间节点</div>
      <div v-if="policy.timeline?.length" class="group">
        <div v-for="(item, i) in policy.timeline" :key="i" class="tl-row">
          <div class="tl-month">{{ item.month }}</div>
          <div class="tl-body">
            <div class="tl-event">{{ item.event }}</div>
            <div class="tl-tag">
              <span class="dot" :style="{ background: typeMeta(item.type).color }"></span>
              {{ typeMeta(item.type).label }}
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty">暂无时间节点</div>
    </template>

    <!-- ================= 材料 ================= -->
    <template v-else>
      <div class="group-header">材料清单</div>
      <div v-if="policy.materials?.length" class="group">
        <div class="cell mat-head">
          <span class="cell-body">
            <span class="cell-title">已备 {{ materialProgress.done }} / {{ materialProgress.total }}</span>
            <span class="cell-subtitle">点一下打勾，自动记住</span>
          </span>
          <button class="btn btn--plain" @click="clearMaterials">清空</button>
        </div>
        <button
          v-for="mat in policy.materials"
          :key="mat.id"
          class="mat-row"
          :class="{ 'is-checked': checkedMaterials[mat.id] }"
          @click="toggleMaterial(mat.id)"
        >
          <span class="mat-check" :class="{ checked: checkedMaterials[mat.id] }">✓</span>
          <span class="cell-body">
            <span class="mat-name">{{ mat.name }}</span>
            <span v-if="mat.note" class="mat-note">{{ mat.note }}</span>
          </span>
          <span class="badge" :class="mat.required ? 'badge--required' : 'badge--optional'">
            {{ mat.required ? '必需' : '选交' }}
          </span>
        </button>
      </div>
      <div v-else class="empty">暂无材料清单</div>
    </template>

    <div class="push-bottom"></div>
  </div>
</template>

<style scoped>
.detail-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 6px var(--gutter) 16px;
}

.detail-head-body {
  flex: 1;
  min-width: 0;
}

.detail-head h1 {
  font-size: 24px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.4px;
}

.detail-head p {
  margin-top: 3px;
  font-size: 14px;
  line-height: 1.35;
  color: var(--label-2);
}

.head-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.mark {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.mark--yes {
  color: #fff;
  background: var(--green);
}

.mark--no {
  color: #fff;
  background: var(--red);
}

.cell--wrap {
  align-items: flex-start;
}

.cell-text {
  font-size: 15px;
  line-height: 1.45;
  letter-spacing: -0.05px;
  color: var(--label);
}

.inline-link {
  color: var(--blue);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.role-card .cell:first-child {
  padding-bottom: 12px;
}

.chain-dot {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--label-2);
  background: var(--bg-fill);
}

.chain-dot.is-active {
  background: var(--blue);
  color: #fff;
}

.mat-head {
  align-items: center;
}

.mat-head .cell-title {
  font-size: 16px;
  font-weight: 600;
}

.mat-row:active {
  background: var(--bg-fill);
}
</style>
