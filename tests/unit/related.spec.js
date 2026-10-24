import { describe, expect, it } from 'vitest'
import { policyCategories } from '../../src/data/policies.js'
import { relatedPolicies } from '../../src/lib/policy.js'

const byId = (id) => policyCategories.find((p) => p.id === id)
const ids = (list) => list.map((p) => p.id)

describe('相关资助', () => {
  it('最多返回 4 条，且不含自身', () => {
    for (const p of policyCategories) {
      const rel = relatedPolicies(p, policyCategories, 4)
      expect(rel.length).toBeLessThanOrEqual(4)
      expect(ids(rel)).not.toContain(p.id)
    }
  })

  it('国家助学金的相关列表包含困难认定（前置条件）', () => {
    const rel = relatedPolicies(byId('national-grant'), policyCategories, 4)
    expect(ids(rel)).toContain('difficulty-assessment')
  })

  it('绿色通道能关联到助学金与贷款', () => {
    const rel = ids(relatedPolicies(byId('green-channel'), policyCategories, 4))
    expect(rel).toContain('national-grant')
    expect(rel).toContain('student-loan')
  })

  it('正文几乎不提其它政策时，用同类政策补齐到 3 条', () => {
    const honor = byId('president-honor')
    const rel = relatedPolicies(honor, policyCategories, 4)
    expect(rel.length).toBeGreaterThanOrEqual(3)
    expect(rel.every((p) => p.tag === honor.tag)).toBe(true)
  })

  it('每条政策至少能给出 3 条相关，不会出现空列表', () => {
    for (const p of policyCategories) {
      const rel = relatedPolicies(p, policyCategories, 4)
      expect(rel.length, `${p.title} 只有 ${rel.length} 条相关`).toBeGreaterThanOrEqual(3)
    }
  })

  it('结果按提及次数降序，第一条是最相关的', () => {
    const rel = relatedPolicies(byId('national-grant'), policyCategories, 4)
    expect(rel[0].id).toBe('difficulty-assessment')
  })
})
