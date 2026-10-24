<script setup>
import { computed } from 'vue'
import { policyCategories } from '../data/policies.js'
import { useRouter } from 'vue-router'
const router = useRouter()
const goTo = (id) => router.push(`/policy/${id}`)

const nationalPolicies = computed(() => policyCategories.filter(p => p.tag === '国家政策'))
const schoolPolicies = computed(() => policyCategories.filter(p => p.tag === '校内政策'))

const heroStats = computed(() => [
  { value: policyCategories.length, color: '#1565C0', label: '资助项目' },
  { value: '20000', color: '#F59E0B', label: '最高贷款' },
  { value: '413', color: '#0D904F', label: '勤工岗位' },
  { value: '9级', color: '#C62828', label: '审批链' },
])
</script>

<template>
  <div>
    <div class="page-header">
      <h1>📚 学生资助政策</h1>
      <div class="subtitle">重庆工程职业技术学院</div>
    </div>

    <!-- Disclaimer -->
    <div style="margin:0 16px 8px;background:#FFF3E0;border:1px solid #FFB74D;border-radius:10px;padding:10px 12px;">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <span style="font-size:18px;flex-shrink:0;">⚠️</span>
        <div style="font-size:11px;color:#BF360C;line-height:1.5;">
          <strong>本应用非重庆工程职业技术学院官方产品</strong>，系个人独立开发，仅供信息参考。<strong>不构成任何政策承诺或法律依据</strong>。具体资助政策、申请条件及金额以学校学生资助管理中心官方通知为准。开发者<strong>不承担</strong>因使用本应用信息产生的任何法律责任。如有疑问请直接联系学校资助中心。
        </div>
      </div>
    </div>

    <!-- Hero stats -->
    <div style="padding:4px 16px 12px;">
      <div style="display:flex;gap:8px;">
        <div v-for="s in heroStats" :key="s.label" style="flex:1;background:#fff;border-radius:10px;padding:10px;box-shadow:var(--shadow);text-align:center;">
          <div :style="{fontSize:'20px',fontWeight:'800',color:s.color}">{{ s.value }}</div>
          <div style="font-size:10px;color:#999;">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <!-- 国家政策 -->
    <div style="padding: 12px 16px 4px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
        <span style="font-size:13px;color:#9e9e9e;font-weight:600;">🇨🇳 国家政策</span>
        <span style="flex:1;height:1px;background:#e0e0e0;"></span>
      </div>
    </div>
    <div class="category-grid">
      <div v-for="cat in nationalPolicies" :key="cat.id" class="category-card" :style="{ borderLeftColor: cat.color }" @click="goTo(cat.id)">
        <span class="card-tag card-tag-national">国家</span>
        <div class="card-icon">{{ cat.icon }}</div>
        <div class="card-title">{{ cat.title }}</div>
        <div class="card-subtitle">{{ cat.subtitle }}</div>
      </div>
    </div>

    <!-- 校内政策 -->
    <div style="padding: 8px 16px 4px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
        <span style="font-size:13px;color:#9e9e9e;font-weight:600;">🏫 校内政策</span>
        <span style="flex:1;height:1px;background:#e0e0e0;"></span>
      </div>
    </div>
    <div class="category-grid">
      <div v-for="cat in schoolPolicies" :key="cat.id" class="category-card" :style="{ borderLeftColor: cat.color }" @click="goTo(cat.id)">
        <span class="card-tag card-tag-school">校内</span>
        <div class="card-icon">{{ cat.icon }}</div>
        <div class="card-title">{{ cat.title }}</div>
        <div class="card-subtitle">{{ cat.subtitle }}</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px 16px 30px;color:#999;font-size:11px;">
      <div style="background:#fff;border-radius:12px;padding:14px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.06);text-align:left;">
        <div style="font-weight:700;font-size:13px;color:#333;margin-bottom:6px;">📞 学生资助管理中心</div>
        <div style="font-size:13px;color:#1a73e8;font-weight:600;margin-bottom:4px;">023-61065934</div>
        <div style="font-size:12px;color:#666;">重庆工程职业技术学院 · 学生处学生资助管理中心</div>
        <div style="font-size:11px;color:#999;margin-top:2px;">如有政策疑问或申请困难，请来电咨询</div>
      </div>
      <div style="background:#FFEBEE;border:2px solid #EF5350;border-radius:10px;padding:12px 14px;margin-bottom:14px;text-align:left;">
        <div style="font-weight:700;font-size:13px;color:#C62828;margin-bottom:6px;">⚡ 法律免责声明</div>
        <div style="font-size:11px;color:#B71C1C;line-height:1.7;">
          1. 本应用<strong>非重庆工程职业技术学院官方开发</strong>，系个人独立制作。<br/>
          2. 所有内容<strong>仅供参考</strong>，不构成任何政策承诺或法律依据。<br/>
          3. 具体政策以<strong>学校学生资助管理中心官方通知</strong>为准。<br/>
          4. 开发者<strong>不承担</strong>因使用本应用信息产生的任何直接或间接责任。<br/>
          5. 如有疑问，请直接联系学校资助中心：<strong>023-61065934</strong>。
        </div>
      </div>
      <div style="background:#E8F5E9;border:1px solid #81C784;border-radius:10px;padding:12px 14px;margin-bottom:14px;text-align:left;">
        <div style="font-weight:700;font-size:13px;color:#2E7D32;margin-bottom:6px;">📱 微信公众号</div>
        <div style="font-size:12px;color:#1B5E20;line-height:1.6;margin-bottom:6px;">
          关注微信公众号 <strong style="font-size:14px;">停不下来的独行侠</strong>
        </div>
        <div style="font-size:11px;color:#388E3C;line-height:1.6;">
          提供学生资助政策咨询 · 申请流程指导 · 材料准备建议<br/>
          另有<strong>付费有偿指导服务</strong>，欢迎添加了解
        </div>
      </div>
      <div style="font-size:12px;color:#666;margin-bottom:4px;">由 <span style="font-weight:700;color:#1565C0;">停不下来的独行侠</span> 独立开发</div>
      <div style="font-size:11px;color:#999;">开发日期：2026年7月19日 · 金额更新至2024年标准</div>
    </div>
  </div>
</template>

<style scoped>
.card-tag {
  position: absolute;
  top: 8px; right: 8px;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 6px;
  font-weight: 600;
}
.card-tag-national { background: #e8f0fe; color: #1a73e8; }
.card-tag-school { background: #f3e8ff; color: #6B3FA0; }
</style>
