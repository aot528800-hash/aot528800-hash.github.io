/**
 * 政策数据的检索与互链逻辑。
 * 抽成纯函数，便于单元测试，也避免两个视图各写一份。
 */

/** 搜索时把常用简称展开成正式名称 */
export const SEARCH_ALIASES = {
  国奖: '国家奖学金',
  国励: '国家励志奖学金',
  励志: '国家励志奖学金',
  助学金: '国家助学金',
  贷款: '生源地信用助学贷款',
  国开行: '生源地信用助学贷款',
  当兵: '服兵役',
  入伍: '服兵役',
  退役: '退役',
  勤工: '勤工助学',
  减免: '学费减免',
  绿色通道: '绿色通道',
  认定: '家庭经济困难学生认定',
}

/** 正文里出现这些词时，可以跳到对应政策 */
export const ALIAS_LINKS = {
  困难认定: 'difficulty-assessment',
  家庭经济困难: 'difficulty-assessment',
  国开行贷款: 'student-loan',
  校内奖学金: 'president-honor',
  基层就业: 'grassroots-compensation',
  服兵役: 'military-compensation',
  退役士兵: 'military-grant',
}

/** 时间节点类型 → 标签与颜色 */
export const TYPE_META = {
  notice: { label: '公告通知', color: 'var(--blue)' },
  student: { label: '学生行动', color: 'var(--orange)' },
  counselor: { label: '辅导员审核', color: 'var(--green)' },
  center: { label: '资助中心', color: 'var(--purple)' },
  publicity: { label: '公示节点', color: 'var(--red)' },
  leadership: { label: '领导小组', color: 'var(--indigo)' },
  all: { label: '全流程', color: 'var(--gray)' },
}

const FALLBACK_TYPE = { label: '节点', color: 'var(--gray)' }

export function typeMeta(type) {
  return TYPE_META[type] || FALLBACK_TYPE
}

/** 标题 + 别名 → 政策 id */
export function buildLinkMap(policies) {
  const map = {}
  for (const p of policies) map[p.title] = p.id
  Object.assign(map, ALIAS_LINKS)
  return map
}

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 构造正文互链的正则（长词优先，避免「国家奖学金」截断「国家励志奖学金」） */
export function buildLinkRe(policies) {
  const terms = [...new Set([...policies.map((p) => p.title), ...Object.keys(ALIAS_LINKS)])]
    .filter((t) => t && t.length >= 4)
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
  return new RegExp('(' + terms.join('|') + ')', 'g')
}

/** 按互链词切分正文，split 带捕获组会把分隔符一起保留 */
export function segments(text, re) {
  return String(text || '').split(re)
}

/** 搜索：标题 / 副标题 / 标签 / 依据 / 简介 + 简称展开，标题命中优先 */
export function searchPolicies(policies, rawQuery) {
  const q = String(rawQuery || '').trim()
  if (!q) return []

  const lower = q.toLowerCase()
  const expanded = Object.keys(SEARCH_ALIASES)
    .filter((k) => q.includes(k))
    .map((k) => SEARCH_ALIASES[k].toLowerCase())

  const hits = []
  const hit = (text) => text.includes(lower) || expanded.some((t) => text.includes(t))

  for (const p of policies) {
    const title = String(p.title || '').toLowerCase()
    const meta = [p.subtitle, p.tag, p.source].filter(Boolean).join(' ').toLowerCase()
    const body = String(p.description || '').toLowerCase()

    // 标题命中排最前；其次副标题/标签/依据；最后才是简介里顺带提到
    let score = 0
    if (hit(title)) score = 3
    else if (hit(meta)) score = 2
    else if (hit(body)) score = 1

    if (score) hits.push({ p, score })
  }

  hits.sort((a, b) => b.score - a.score)
  return hits.map((h) => h.p)
}

/**
 * 相关资助：按「在本政策正文里被提及的次数」排序。
 * 标题权重 2（明确指代），别名权重 1（「困难认定」这类通用词出现频率过高，
 * 权重太大反而会把真正相关的项目挤掉）。
 */
export function relatedPolicies(policy, all, limit = 4) {
  if (!policy) return []

  const corpus = [
    policy.overview,
    policy.description,
    ...(policy.rules?.prerequisites || []),
    ...(policy.rules?.exclusions || []),
    ...(policy.rules?.disqualifiers || []),
    ...(policy.approvalChain || []).flatMap((lvl) => (lvl.steps || []).map((s) => `${s.title} ${s.desc}`)),
    ...(policy.timeline || []).map((t) => `${t.event} ${t.desc || ''}`),
    ...(policy.materials || []).map((m) => `${m.name} ${m.note || ''}`),
  ].join(' ')

  const count = (needle) => {
    let n = 0
    let i = 0
    while ((i = corpus.indexOf(needle, i)) !== -1) {
      n++
      i += needle.length
    }
    return n
  }

  const scored = []
  for (const p of all) {
    if (p.id === policy.id) continue
    let score = count(p.title) * 2
    for (const [alias, id] of Object.entries(ALIAS_LINKS)) {
      if (id === p.id) score += count(alias)
    }
    if (score > 0) scored.push({ p, score })
  }

  const picked = scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.p)

  // 正文提及太少时，用同类（国家/校内）政策补齐，避免出现只有一条的相关列表
  if (picked.length < 3) {
    for (const p of all) {
      if (p.id === policy.id || picked.includes(p)) continue
      if (p.tag !== policy.tag) continue
      picked.push(p)
      if (picked.length >= 3) break
    }
  }

  return picked
}
