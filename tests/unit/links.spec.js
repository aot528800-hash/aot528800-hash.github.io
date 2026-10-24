import { describe, expect, it } from 'vitest'
import { policyCategories } from '../../src/data/policies.js'
import {
  ALIAS_LINKS,
  buildLinkMap,
  buildLinkRe,
  escapeRe,
  segments,
  typeMeta,
} from '../../src/lib/policy.js'

describe('正文互链', () => {
  const map = buildLinkMap(policyCategories)
  const re = buildLinkRe(policyCategories)

  it('每个政策标题都能映射到自己的 id', () => {
    for (const p of policyCategories) {
      expect(map[p.title]).toBe(p.id)
    }
  })

  it('别名映射存在', () => {
    expect(map['困难认定']).toBe('difficulty-assessment')
    for (const [alias, id] of Object.entries(ALIAS_LINKS)) {
      expect(map[alias]).toBe(id)
    }
  })

  it('长词优先：国家励志奖学金不会被拆成 国家奖学金', () => {
    const text = '想申请国家励志奖学金的话'
    const parts = segments(text, re)
    expect(parts).toContain('国家励志奖学金')
    expect(parts).not.toContain('国家奖学金')
  })

  it('切分后拼回去和原文一致', () => {
    const text = '先做困难认定，再申请国家助学金和学费减免。'
    expect(segments(text, re).join('')).toBe(text)
  })

  it('不含互链词的文本原样返回', () => {
    const text = '这是一段没有政策名称的普通说明。'
    expect(segments(text, re)).toEqual([text])
  })

  it('空值安全', () => {
    expect(segments('', re)).toEqual([''])
    expect(segments(null, re)).toEqual([''])
    expect(segments(undefined, re)).toEqual([''])
  })

  it('正则元字符被正确转义', () => {
    expect(escapeRe('学费（试行）')).toBe('学费（试行）')
    expect(escapeRe('a.b*c')).toBe('a\\.b\\*c')
  })
})

describe('时间节点类型', () => {
  it('已知类型返回对应标签', () => {
    expect(typeMeta('publicity').label).toBe('公示节点')
    expect(typeMeta('student').label).toBe('学生行动')
    expect(typeMeta('all').label).toBe('全流程')
  })

  it('未知类型回退为默认节点', () => {
    expect(typeMeta('unknown-type').label).toBe('节点')
    expect(typeMeta(undefined).label).toBe('节点')
  })
})
