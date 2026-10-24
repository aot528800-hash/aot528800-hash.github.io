<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { policyCategories } from '../data/policies.js'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps({ id: String })
const router = useRouter()

const policy = computed(() => policyCategories.find(p => p.id === props.id))
const activeTab = ref('overview')
const selectedRole = ref(0)
const showFullChain = ref(false)

const STORAGE_PREFIX = 'aid_materials_'
const checkedMaterials = ref({})

function loadMaterials() {
  checkedMaterials.value = {}
  if (!policy.value) return
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + policy.value.id)
    if (saved) checkedMaterials.value = JSON.parse(saved)
  } catch { checkedMaterials.value = {} }
}

function saveMaterials() {
  if (!policy.value) return
  localStorage.setItem(STORAGE_PREFIX + policy.value.id, JSON.stringify(checkedMaterials.value))
}

function toggleMaterial(materialId) {
  checkedMaterials.value[materialId] = !checkedMaterials.value[materialId]
  saveMaterials()
}

function clearMaterials() {
  checkedMaterials.value = {}
  saveMaterials()
}

const policyLinkMap = computed(() => {
  const map = {}
  policyCategories.forEach(p => { map[p.title] = p.id })
  return {
    ...map,
    '困难认定': 'difficulty-assessment',
    '家庭经济困难': 'difficulty-assessment',
    '国开行贷款': 'student-loan',
    '校内奖学金': 'president-honor',
    '基层就业': 'grassroots-compensation',
    '服兵役': 'military-compensation',
    '退役士兵': 'military-grant',
  }
})

function getPolicyLink(name) {
  return policyLinkMap.value[name] || null
}

function goPolicy(id) {
  if (id) router.push('/policy/' + id)
}

onMounted(() => {
  if (!policy.value) router.replace('/')
  loadMaterials()
  window.scrollTo(0, 0)
})

watch(activeTab, () => { window.scrollTo(0, 0) })
watch(() => props.id, () => {
  if (!policyCategories.find(p => p.id === props.id)) { router.replace('/'); return }
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
</script>

<template>
  <div v-if="policy">
    <div class="page-header">
      <div class="breadcrumb">
        <router-link to="/" class="breadcrumb-link">首页</router-link>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-current">{{ policy.title }}</span>
      </div>
      <h1>{{ policy.icon }} {{ policy.title }}</h1>
      <div class="subtitle">{{ policy.subtitle }}</div>
    </div>

    <div class="section-tabs">
      <button class="section-tab" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">📋 总览</button>
      <button class="section-tab" :class="{ active: activeTab === 'flow' }" @click="activeTab = 'flow'">👥 业务流程</button>
      <button class="section-tab" :class="{ active: activeTab === 'timeline' }" @click="activeTab = 'timeline'">📅 时间节点</button>
      <button class="section-tab" :class="{ active: activeTab === 'materials' }" @click="activeTab = 'materials'">📎 材料清单</button>
    </div>

    <!-- OVERVIEW -->
    <div v-if="activeTab === 'overview'" class="content-block">
      <div v-if="policy.rules" class="eligibility-box">
        <div class="eligibility-header">⚡ 资格条件速查</div>
        <div class="eligibility-grid">
          <div class="eligibility-col eligibility-positive">
            <div class="eligibility-col-title">✅ 你可以申请，如果：</div>
            <ul class="eligibility-list">
              <li v-for="(r,i) in policy.rules.prerequisites" :key="'p'+i">
                <span v-for="(part, pi) in r.split(/(困难认定|家庭经济困难学生认定|国家奖学金|国家励志奖学金|国家助学金|筑梦奖学金|国家助学贷款|生源地信用助学贷款|校长荣誉奖学金|学习综合奖学金|学习优胜奖学金|学习进步奖学金|交换生专项奖学金|勤工助学|学费减免|新生困难补助|临时困难补助|节假日慰问金|绿色通道|基层就业|服兵役|退役士兵)/g)" :key="pi">
                  <a v-if="getPolicyLink(part)" class="inline-link" @click.stop="goPolicy(getPolicyLink(part))">{{ part }}</a>
                  <span v-else>{{ part }}</span>
                </span>
              </li>
            </ul>
          </div>
          <div class="eligibility-col eligibility-negative">
            <div class="eligibility-col-title">❌ 负面清单：你不能申请/获得，如果：</div>
            <ul class="eligibility-list">
              <li v-for="(r,i) in [...(policy.rules.exclusions||[]), ...(policy.rules.disqualifiers||[])]" :key="'n'+i">
                <span v-for="(part, pi) in r.split(/(困难认定|家庭经济困难学生认定|国家奖学金|国家励志奖学金|国家助学金|筑梦奖学金|国家助学贷款|生源地信用助学贷款|校长荣誉奖学金|学习综合奖学金|学习优胜奖学金|学习进步奖学金|交换生专项奖学金|勤工助学|学费减免|新生困难补助|临时困难补助|节假日慰问金|绿色通道|基层就业|服兵役|退役士兵)/g)" :key="pi">
                  <a v-if="getPolicyLink(part)" class="inline-link" @click.stop="goPolicy(getPolicyLink(part))">{{ part }}</a>
                  <span v-else>{{ part }}</span>
                </span>
              </li>
            </ul>
            <div v-if="!(policy.rules.exclusions||[]).length && !(policy.rules.disqualifiers||[]).length" style="font-size:12px;color:#999;padding:4px 0;">无特殊限制</div>
          </div>
        </div>
      </div>
      <div class="markdown-body" v-html="renderMarkdown(policy.overview)"></div>
      <div v-if="policy.source" style="margin-top:16px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#999;">
        📄 政策依据：{{ policy.source }}
      </div>
    </div>

    <!-- FLOW -->
    <div v-if="activeTab === 'flow' && policy.approvalChain?.length">
      <div style="padding:12px 16px 0;">
        <div style="font-size:12px;color:#999;margin-bottom:8px;">选择你的角色，查看你的任务</div>
        <div class="role-chips">
          <button v-for="(level, i) in policy.approvalChain" :key="i" class="role-chip" :class="{ 'role-chip-active': selectedRole === i }" @click="selectedRole = i; showFullChain = false">
            <span class="role-chip-icon">{{ level.icon }}</span>
            <span class="role-chip-label">{{ level.role }}</span>
            <span class="role-chip-num">L{{ level.level }}</span>
          </button>
        </div>
      </div>

      <div v-if="policy.approvalChain[selectedRole]" class="content-block" style="margin-top:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #eee;">
          <span style="font-size:32px;">{{ policy.approvalChain[selectedRole].icon }}</span>
          <div>
            <div style="font-size:17px;font-weight:700;color:#202124;">{{ policy.approvalChain[selectedRole].role }}</div>
            <div style="font-size:12px;color:#999;">第 {{ policy.approvalChain[selectedRole].level }} 级审批</div>
          </div>
        </div>
        <div class="chain-steps">
          <div v-for="(step, j) in policy.approvalChain[selectedRole].steps" :key="j" class="chain-step">
            <div class="chain-step-num">{{ j + 1 }}</div>
            <div>
              <div class="chain-step-title">{{ step.title }}</div>
              <div class="chain-step-desc">{{ step.desc }}</div>
            </div>
          </div>
        </div>
        <div v-if="policy.approvalChain[selectedRole].publicity" class="chain-publicity">
          📣 {{ policy.approvalChain[selectedRole].publicity }}
        </div>
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #eee;font-size:12px;color:#999;display:flex;align-items:center;gap:4px;">
          <span>📍 在审批链中的位置：</span>
          <span v-for="(level, i) in policy.approvalChain" :key="'pos'+i" style="display:inline-flex;align-items:center;gap:2px;">
            <span v-if="i > 0" style="color:#ccc;">→</span>
            <span :style="{fontWeight: i === selectedRole ? '700' : '400', color: i === selectedRole ? '#1a73e8' : '#999', fontSize: i === selectedRole ? '13px' : '11px' }">{{ level.icon }}</span>
          </span>
        </div>
      </div>

      <div style="padding:0 16px 16px;text-align:center;">
        <button class="chain-toggle" @click="showFullChain = !showFullChain">
          {{ showFullChain ? '收起完整审批链 ▲' : '查看完整审批链 ▼' }}
        </button>
      </div>

      <div v-if="showFullChain" class="chain-container" style="padding-bottom:16px;">
        <div v-for="(level, i) in policy.approvalChain" :key="'full'+i" class="chain-level">
          <div class="chain-connector">
            <div class="chain-dot" :class="{ 'chain-dot-first': i === 0, 'chain-dot-last': i === policy.approvalChain.length - 1, 'chain-dot-active': i === selectedRole }" @click="selectedRole = i; showFullChain = false">
              <span class="chain-level-num">{{ level.level }}</span>
            </div>
            <div v-if="i < policy.approvalChain.length - 1" class="chain-line"></div>
          </div>
          <div class="chain-card" @click="selectedRole = i; showFullChain = false" style="cursor:pointer;">
            <div class="chain-role-header">
              <span class="chain-role-icon">{{ level.icon }}</span>
              <span class="chain-role-name">{{ level.role }}</span>
            </div>
            <div style="font-size:12px;color:#666;">{{ level.steps.length }} 项任务{{ level.publicity ? ' · ' + level.publicity : '' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- TIMELINE -->
    <div v-if="activeTab === 'timeline'" class="content-block">
      <h2><span class="section-emoji">📅</span> 关键时间节点</h2>
      <div class="timeline-list" style="margin-top:16px;">
        <div v-for="(item, i) in policy.timeline" :key="i" class="timeline-item">
          <div class="tl-month">{{ item.month }}</div>
          <div class="tl-event">{{ item.event }}</div>
          <div class="tl-desc">
            <span v-if="item.type === 'notice'" style="color:#1a73e8;">📢 公告通知</span>
            <span v-else-if="item.type === 'student'" style="color:#e8710a;">🧑‍🎓 学生行动</span>
            <span v-else-if="item.type === 'counselor'" style="color:#0d904f;">👨‍🏫 辅导员审核</span>
            <span v-else-if="item.type === 'center'" style="color:#7b1fa2;">🏢 资助中心</span>
            <span v-else-if="item.type === 'publicity'" style="color:#c62828;">📣 公示 ⚠️</span>
            <span v-else-if="item.type === 'leadership'" style="color:#1565c0;">🏛️ 领导小组</span>
            <span v-else-if="item.type === 'all'" style="color:#5f6368;">🔄 全流程</span>
          </div>
        </div>
      </div>
    </div>

    <!-- MATERIALS -->
    <div v-if="activeTab === 'materials'" class="content-block">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2 style="margin:0;"><span class="section-emoji">📎</span> 所需材料清单</h2>
        <button @click="clearMaterials" style="font-size:12px;color:#999;background:none;border:1px solid #e0e0e0;border-radius:12px;padding:3px 10px;cursor:pointer;">清空</button>
      </div>
      <p style="font-size:12px;color:#999;margin-bottom:12px;">点击方框打勾 ✅，逐项准备不遗漏</p>
      <div class="material-list">
        <div v-for="mat in policy.materials" :key="mat.id" class="material-item">
          <div class="material-check" :class="{ checked: checkedMaterials[mat.id] }" @click="toggleMaterial(mat.id)">
            {{ checkedMaterials[mat.id] ? '✓' : '' }}
          </div>
          <div class="material-info">
            <div class="material-name">{{ mat.name }}</div>
            <div class="material-note" v-if="mat.note">{{ mat.note }}</div>
          </div>
          <div class="material-required" :class="mat.required ? 'required-tag' : 'optional-tag'">
            {{ mat.required ? '必需' : '选交' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.breadcrumb { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 13px; }
.breadcrumb-link { color: var(--primary); text-decoration: none; font-weight: 500; }
.breadcrumb-sep { color: var(--text-tertiary); font-size: 16px; }
.breadcrumb-current { color: var(--text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.inline-link { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; font-weight: 500; }
.inline-link:active { color: var(--primary-dark); }

.eligibility-box { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 18px; }
.eligibility-header { background: var(--text); color: #fff; padding: 10px 14px; font-size: 14px; font-weight: 600; text-align: center; }
.eligibility-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
.eligibility-col { padding: 12px 14px; }
.eligibility-positive { background: #f1f8e9; border-right: 1px solid #c8e6c9; }
.eligibility-negative { background: #fef3f2; }
.eligibility-col-title { font-size: 12px; font-weight: 700; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(0,0,0,0.08); }
.eligibility-positive .eligibility-col-title { color: #2e7d32; }
.eligibility-negative .eligibility-col-title { color: #c62828; }
.eligibility-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.eligibility-list li { font-size: 12px; color: #333; line-height: 1.5; padding-left: 12px; position: relative; }
.eligibility-positive .eligibility-list li::before { content: '✓'; position: absolute; left: 0; color: #4caf50; font-weight: 700; font-size: 11px; }
.eligibility-negative .eligibility-list li::before { content: '✗'; position: absolute; left: 0; color: #e53935; font-weight: 700; font-size: 12px; }

.role-chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.role-chips::-webkit-scrollbar { display: none; }
.role-chip { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 22px; border: 1.5px solid var(--border); background: #fff; cursor: pointer; white-space: nowrap; font-size: 13px; color: var(--text-secondary); transition: all 0.15s; flex-shrink: 0; }
.role-chip:active { transform: scale(0.96); }
.role-chip-active { border-color: var(--primary); background: var(--primary-light); color: var(--primary); font-weight: 600; }
.role-chip-icon { font-size: 18px; }
.role-chip-label { font-size: 12px; }
.role-chip-num { font-size: 10px; background: #f0f0f0; padding: 2px 6px; border-radius: 8px; color: #888; font-weight: 500; }
.role-chip-active .role-chip-num { background: var(--primary); color: #fff; }

.chain-step { display: flex; gap: 10px; padding: 10px 12px; background: #f8f9fb; border-radius: 8px; border-left: 3px solid #e0e0e0; margin-bottom: 0; }
.chain-step-num { width: 22px; height: 22px; border-radius: 50%; background: #e8e8e8; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #888; flex-shrink: 0; }
.chain-step-title { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 2px; }
.chain-step-desc { font-size: 12px; color: #666; line-height: 1.5; }

.chain-toggle { padding: 8px 20px; border-radius: 18px; border: 1px solid var(--border); background: #fff; font-size: 13px; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
.chain-toggle:active { background: #f5f5f5; }

.chain-container { padding: 0 16px 20px; }
.chain-level { display: flex; gap: 0; }
.chain-connector { width: 36px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.chain-dot { width: 28px; height: 28px; border-radius: 50%; background: #e8e8e8; display: flex; align-items: center; justify-content: center; z-index: 1; transition: all 0.2s; cursor: pointer; }
.chain-dot-first { background: var(--primary); box-shadow: 0 0 0 4px rgba(59,130,246,0.15); }
.chain-dot-first .chain-level-num { color: #fff; font-weight: 700; }
.chain-dot-last { background: #c62828; box-shadow: 0 0 0 4px rgba(198,40,40,0.15); }
.chain-dot-last .chain-level-num { color: #fff; font-weight: 700; }
.chain-dot-active { background: var(--accent); box-shadow: 0 0 0 4px rgba(245,158,11,0.2); transform: scale(1.1); }
.chain-dot-active .chain-level-num { color: #fff; font-weight: 700; }
.chain-level-num { font-size: 12px; color: #888; font-weight: 600; }
.chain-line { width: 2px; flex: 1; min-height: 16px; background: #e0e0e0; }
.chain-card { flex: 1; background: #fff; border-radius: 10px; padding: 12px 14px; margin-bottom: 4px; margin-left: 8px; border: 1px solid var(--border-light); }
.chain-role-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.chain-role-icon { font-size: 22px; }
.chain-role-name { font-size: 15px; font-weight: 700; color: var(--text); }
.chain-steps { display: flex; flex-direction: column; gap: 8px; }
.chain-publicity { margin-top: 8px; padding: 6px 10px; background: #fff3cd; border-radius: 6px; font-size: 12px; color: #856404; font-weight: 500; }
@media (max-width: 360px) {
  .eligibility-grid { grid-template-columns: 1fr; }
  .eligibility-positive { border-right: none; border-bottom: 1px solid #c8e6c9; }
}
</style>