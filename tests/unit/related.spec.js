import { describe, expect, it } from 'vitest'
import { policyCategories } from '../../src/data/policies.js'
import { relatedPolicies, relationReason } from '../../src/lib/policy.js'

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

describe('相关资助的推荐理由', () => {
  const ALLOWED = ['申请前置', '同年互斥', '可同时获得', '流程涉及', '文中提到', '同属国家', '同属校内', '相关']

  it('国家助学金 → 困难认定：申请前置', () => {
    expect(relationReason(byId('national-grant'), byId('difficulty-assessment'))).toBe('申请前置')
  })

  it('国家奖学金 → 国家励志奖学金：同年互斥', () => {
    expect(relationReason(byId('national-scholarship'), byId('encouragement-scholarship'))).toBe('同年互斥')
  })

  it('国家助学金 → 国家奖学金：可同时获得', () => {
    expect(relationReason(byId('national-grant'), byId('national-scholarship'))).toBe('可同时获得')
  })

  it('校长荣誉奖学金 → 学习优胜奖学金：同属校内', () => {
    expect(relationReason(byId('president-honor'), byId('excellence-scholarship'))).toBe('同属校内')
  })

  it('每条相关都有非空且合法的理由', () => {
    for (const p of policyCategories) {
      for (const r of relatedPolicies(p, policyCategories, 4)) {
        const reason = relationReason(p, r)
        expect(reason, `${p.title} → ${r.title}`).toBeTruthy()
        expect(ALLOWED, `${p.title} → ${r.title} 得到「${reason}」`).toContain(reason)
      }
    }
  })

  it('理由不会把互斥说成可同时获得', () => {
    const reason = relationReason(byId('encouragement-scholarship'), byId('national-scholarship'))
    expect(reason).not.toBe('可同时获得')
  })
})