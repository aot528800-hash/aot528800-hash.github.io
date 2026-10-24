<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Share } from '@capacitor/share'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { policyCategories } from '../data/policies.js'
import { buildLinkMap, buildLinkRe, relatedPolicies, relationReason, segments as splitByLinks, typeMeta } from '../lib/policy.js'
import { handlePolicyLinkClick, linkifyPolicies } from '../lib/linkify.js'
import { backLabel } from '../lib/nav.js'

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

/* ---------- 正文里的政策互链（逻辑见 src/lib/policy.js） ---------- */
const linkMap = computed(() => buildLinkMap(policyCategories))
const linkRe = computed(() => buildLinkRe(policyCategories))

function segments(text) {
  return splitByLinks(text, linkRe.value)
}

function linkFor(part) {
  const id = linkMap.value[part] || null
  // 正文提到本政策自己时不必生成链接
  return id && id !== policy.value?.id ? id : null
}

function goPolicy(pid) {
  if (pid) router.push('/policy/' + pid)
}

/* ---------- 生命周期 ---------- */
function goBack() {
  // 有应用内上一页就回退，否则（如冷启动直达详情）回首页
  const state = window.history.state
  if (state && state.back) router.back()
  else router.replace('/')
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

/* 正文只解析一次，避免每次渲染都跑一遍 marked + DOMPurify */
const overviewHtml = computed(() => {
  const text = policy.value?.overview
  if (!text) return ''
  const safe = DOMPurify.sanitize(marked.parse(text))
  // 正文里出现的政策名称变成可点链接（跳过本政策自身）
  return linkifyPolicies(safe, linkRe.value, linkMap.value, policy.value?.id)
})

const previousTitle = computed(() => backLabel())
const related = computed(() =>
  relatedPolicies(policy.value, policyCategories, 4).map((p) => ({
    ...p,
    reason: relationReason(policy.value, p),
  })),
)

function onMdClick(event) {
  handlePolicyLinkClick(event, goPolicy)
}

/* 分享：走系统分享面板（安卓上是原生 share sheet，可发给微信/QQ/同学） */
async function sharePolicy() {
  if (!policy.value) return
  const text = `${policy.value.title}（${policy.value.subtitle}）\n\n来自「资助通」· 非官方，具体以学校资助中心通知为准`

  try {
    const can = await Share.canShare()
    if (can && can.value) {
      await Share.share({ title: policy.value.title, text, dialogTitle: '分享这条政策' })
      return
    }
  } catch {
    /* 插件不可用则继续降级 */
  }

  try {
    if (navigator.share) await navigator.share({ title: policy.value.title, text })
    else if (navigator.clipboard) await navigator.clipboard.writeText(text)
  } catch {
    /* 用户取消 */
  }
}

const tint = (hex) => (hex || '#8e8e93') + '24'
</script>

<template>
  <div v-if="policy">
    <header class="nav-bar">
      <button class="nav-back" :aria-label="'返回 ' + previousTitle" @click="goBack">
        <svg viewBox="0 0 12 20" aria-hidden="true">
          <path d="M10.6 1.6 2 10l8.6 8.4" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ previousTitle }}</span>
      </button>
      <div class="nav-title">{{ policy.title }}</div>
      <button class="nav-action" aria-label="分享这条政策" @click="sharePolicy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 15.2V3.4" />
          <path d="M8.1 7.3 12 3.4l3.9 3.9" />
          <path d="M5 12.6v6.1a1.9 1.9 0 0 0 1.9 1.9h10.2a1.9 1.9 0 0 0 1.9-1.9v-6.1" />
        </svg>
      </button>
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
        </div>
        <div v-if="policy.source" class="detail-source">依据 {{ policy.source }}</div>
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
        <div class="md" v-html="overviewHtml" @click="onMdClick"></div>
      </div>

      <template v-if="related.length">
        <div class="group-header">相关资助</div>
        <div class="group">
          <button v-for="r in related" :key="r.id" class="cell cell--tappable" @click="goPolicy(r.id)">
            <span class="tile" :style="{ background: tint(r.color) }">{{ r.icon }}</span>
            <span class="cell-body">
              <span class="cell-title">{{ r.title }}</span>
              <span class="cell-subtitle">{{ r.subtitle }}</span>
            </span>
            <span class="relation-tag">{{ r.reason }}</span>
            <svg class="chev" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M1.5 1.5 6 6.5l-4.5 5" />
            </svg>
          </button>
        </div>
      </template>
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
