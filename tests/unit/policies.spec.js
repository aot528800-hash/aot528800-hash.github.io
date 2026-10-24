import { describe, expect, it } from 'vitest'
import { annualSchedule, policyCategories } from '../../src/data/policies.js'
import { TYPE_META } from '../../src/lib/policy.js'

const REQUIRED_FIELDS = [
  'id', 'icon', 'title', 'subtitle', 'color', 'tag',
  'source', 'description', 'overview', 'rules', 'approvalChain', 'timeline', 'materials',
]

describe('政策数据完整性', () => {
  it('条目数与分组数量符合预期', () => {
    expect(policyCategories).toHaveLength(21)
    expect(policyCategories.filter((p) => p.tag === '国家政策')).toHaveLength(10)
    expect(policyCategories.filter((p) => p.tag === '校内政策')).toHaveLength(10)
    expect(policyCategories.filter((p) => p.tag === '社会捐资')).toHaveLength(1)
  })

  it('id 与标题都不重复', () => {
    const ids = policyCategories.map((p) => p.id)
    const titles = policyCategories.map((p) => p.title)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('每条都有必填字段且非空', () => {
    for (const p of policyCategories) {
      for (const f of REQUIRED_FIELDS) {
        expect(p[f], `${p.id} 缺字段 ${f}`).toBeTruthy()
      }
      expect(p.overview.length, `${p.id} 正文过短`).toBeGreaterThan(100)
    }
  })

  it('标签只有国家/校内两类', () => {
    for (const p of policyCategories) {
      expect(['国家政策', '校内政策', '社会捐资']).toContain(p.tag)
    }
  })

  it('主题色是合法 6 位十六进制', () => {
    for (const p of policyCategories) {
      expect(p.color, `${p.id} 颜色不合法: ${p.color}`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('审批链层级连续、步骤完整', () => {
    for (const p of policyCategories) {
      const chain = p.approvalChain
      expect(chain.length, `${p.id} 审批链为空`).toBeGreaterThanOrEqual(3)

      chain.forEach((level, i) => {
        expect(level.level, `${p.id} 第 ${i + 1} 级序号错`).toBe(i + 1)
        expect(level.role, `${p.id} 第 ${i + 1} 级缺角色`).toBeTruthy()
        expect(level.icon, `${p.id} 第 ${i + 1} 级缺图标`).toBeTruthy()
        expect(level.steps.length, `${p.id} ${level.role} 无步骤`).toBeGreaterThan(0)

        for (const step of level.steps) {
          expect(step.title, `${p.id} ${level.role} 步骤缺标题`).toBeTruthy()
          expect(step.desc, `${p.id} ${level.role} 步骤缺说明`).toBeTruthy()
        }
      })
    }
  })

  it('材料清单 id 唯一、必选标记为布尔值', () => {
    for (const p of policyCategories) {
      const ids = p.materials.map((m) => m.id)
      expect(ids.length, `${p.id} 无材料`).toBeGreaterThan(0)
      expect(new Set(ids).size, `${p.id} 材料 id 重复`).toBe(ids.length)

      for (const m of p.materials) {
        expect(m.name, `${p.id} 材料缺名称`).toBeTruthy()
        expect(typeof m.required, `${p.id} ${m.name} required 非布尔`).toBe('boolean')
      }
    }
  })

  it('时间节点类型都在白名单内', () => {
    for (const p of policyCategories) {
      for (const t of p.timeline) {
        expect(t.month, `${p.id} 时间节点缺月份`).toBeTruthy()
        expect(t.event, `${p.id} 时间节点缺事件`).toBeTruthy()
        expect(Object.keys(TYPE_META), `${p.id} 未知类型 ${t.type}`).toContain(t.type)
      }
    }
  })

  it('资格条件字段结构正确', () => {
    for (const p of policyCategories) {
      expect(Array.isArray(p.rules.prerequisites), `${p.id} prerequisites 非数组`).toBe(true)
      expect(Array.isArray(p.rules.exclusions), `${p.id} exclusions 非数组`).toBe(true)
      expect(Array.isArray(p.rules.disqualifiers), `${p.id} disqualifiers 非数组`).toBe(true)
    }
  })
})

describe('全年日程数据', () => {
  it('10 个月段且月份不重复', () => {
    expect(annualSchedule).toHaveLength(10)
    const months = annualSchedule.map((m) => m.month)
    expect(new Set(months).size).toBe(months.length)
  })

  it('每个月段至少一个事件且事件有标题', () => {
    for (const m of annualSchedule) {
      expect(m.events.length, `${m.month} 无事件`).toBeGreaterThan(0)
      for (const e of m.events) {
        expect(e.title, `${m.month} 事件缺标题`).toBeTruthy()
      }
    }
  })
})
