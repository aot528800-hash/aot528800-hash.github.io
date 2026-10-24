import { describe, expect, it } from 'vitest'
import { policyCategories } from '../../src/data/policies.js'
import { searchPolicies } from '../../src/lib/policy.js'

const titles = (q) => searchPolicies(policyCategories, q).map((p) => p.title)

describe('搜索', () => {
  it('空查询不返回结果', () => {
    expect(searchPolicies(policyCategories, '')).toEqual([])
    expect(searchPolicies(policyCategories, '   ')).toEqual([])
    expect(searchPolicies(policyCategories, null)).toEqual([])
  })

  it('精确标题命中', () => {
    expect(titles('国家奖学金')).toContain('国家奖学金')
    expect(titles('勤工助学')).toEqual(['勤工助学'])
  })

  it('简称能展开：国奖 / 国励，且标题命中排第一', () => {
    // 「学习综合奖学金」的简介里提到「与国奖互斥」，会被正文命中，但不能压过标题命中
    expect(titles('国奖')[0]).toBe('国家奖学金')
    expect(titles('国励')[0]).toBe('国家励志奖学金')
  })

  it('标题命中排在正文命中之前', () => {
    const res = titles('国奖')
    const idxTitle = res.indexOf('国家奖学金')
    const idxBody = res.indexOf('学习综合奖学金')
    expect(idxTitle).toBe(0)
    if (idxBody !== -1) expect(idxTitle).toBeLessThan(idxBody)
  })

  it('简称能展开：贷款 / 当兵 / 勤工', () => {
    expect(titles('贷款')).toContain('生源地信用助学贷款')
    expect(titles('当兵')).toContain('服兵役学费补偿/贷款代偿')
    expect(titles('勤工')).toContain('勤工助学')
  })

  it('首尾空格不影响结果', () => {
    expect(titles('  国奖  ')).toEqual(titles('国奖'))
  })

  it('无匹配时返回空数组', () => {
    expect(titles('量子引力')).toEqual([])
  })

  it('结果只来自传入的数据集', () => {
    const res = searchPolicies(policyCategories, '奖学金')
    expect(res.length).toBeGreaterThan(0)
    expect(res.every((p) => policyCategories.includes(p))).toBe(true)
  })
})
