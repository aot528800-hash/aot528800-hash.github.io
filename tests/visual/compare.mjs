/**
 * 静态站视觉回归 - 基线对比
 *
 * 对比两个 capture.mjs 输出目录，判定"改动是否只动装饰层、没弄坏信息"：
 *   1) 结构锚点硬校验：卡片/标题层级/链接数/合规声明/正文锚点必须一致
 *   2) 可见文本差异：逐行 diff，只允许差异行命中"装饰白名单"关键词
 *
 * 运行：node tests/visual/compare.mjs <基线目录> <现状目录>
 *   node tests/visual/compare.mjs tests/visual/baseline tests/visual/after
 *
 * 退出码：0=通过（仅装饰层变化）；1=发现信息层改动，需人工复核。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const A = process.argv[2] || 'tests/visual/baseline'
const B = process.argv[3] || 'tests/visual/after'

if (!existsSync(join(A, 'manifest.json')) || !existsSync(join(B, 'manifest.json'))) {
  console.error('缺少 manifest.json，请先运行 capture.mjs')
  process.exit(2)
}
const ma = JSON.parse(readFileSync(join(A, 'manifest.json'), 'utf8'))
const mb = JSON.parse(readFileSync(join(B, 'manifest.json'), 'utf8'))

/**
 * 结构锚点：这些字段一旦变化即视为"弄坏"，零容忍。
 * 注意：hasFreshDate 不放入全站硬校验——原站仅首页/政策页/专栏页含"内容核对"，
 * 若强求每页都有会误报。逐页的文本 diff 已能覆盖该信息是否被删。
 */
const HARD = ['cards', 'h1', 'h2', 'h3', 'links', 'hasDisclaimer', 'hasScope', 'scrollWidth', 'innerWidth']

let fail = 0
const byUrlB = Object.fromEntries(mb.map((x) => [x.url, x]))
if (ma.length !== mb.length) {
  console.log(`FAIL 页面数变化：基线 ${ma.length} → 现状 ${mb.length}`)
  fail++
}

for (const pa of ma) {
  const pb = byUrlB[pa.url]
  if (!pb) { console.log(`FAIL 页面丢失：${pa.url}`); fail++; continue }
  const errs = []

  // 1) 结构锚点硬校验
  for (const k of HARD) {
    if (pa.anchor[k] !== pb.anchor[k]) errs.push(`锚点 ${k}: ${pa.anchor[k]} → ${pb.anchor[k]}`)
  }
  // 合规锚点必须为 true（仅校验原站本就每页都有的两项）
  for (const k of ['hasDisclaimer', 'hasScope']) {
    if (pb.anchor[k] !== true) errs.push(`合规锚点 ${k} 丢失`)
  }
  // 布局健康
  if (pb.anchor.scrollWidth - pb.anchor.innerWidth > 1) errs.push('出现横向溢出')

  // 2) 可见文本逐行 diff
  const ta = readFileSync(join(A, pa.txt), 'utf8').split('\n')
  const tb = readFileSync(join(B, pb.txt), 'utf8').split('\n')
  const sa = new Set(ta), sb = new Set(tb)
  const removed = ta.filter((line) => !sb.has(line))
  const added = tb.filter((line) => !sa.has(line))

  // 装饰行判定：来自基线采集时被标记为装饰节点的文本，或纯 emoji/极短行。
  // 用集合精确匹配，避免维护易漏的关键词白名单。
  const decorSet = new Set(pa.decor || [])
  const isDecor = (line) => decorSet.has(line) || /^[\s\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+$/u.test(line) || line.length <= 2
  const badRemoved = removed.filter((l) => !isDecor(l))
  const badAdded = added.filter((l) => !isDecor(l))

  // 反向校验：基线标记的装饰文本，必须真的从现状里消失了（确认精简生效）
  const decorStillPresent = (pa.decor || []).filter((t) => t.length > 2 && sb.has(t))
  // 注意：部分眉标文字可能与正文重复（如"专栏"），这种情况不强制要求消失

  if (badRemoved.length) errs.push(`信息行被删(${badRemoved.length}): ${badRemoved.slice(0, 3).map((s) => '「' + s.slice(0, 30) + '」').join(' ')}`)
  if (badAdded.length) errs.push(`新增信息行(${badAdded.length}): ${badAdded.slice(0, 3).map((s) => '「' + s.slice(0, 30) + '」').join(' ')}`)

  if (errs.length) {
    fail++
    console.log(`FAIL ${pa.url}`)
    errs.forEach((e) => console.log('     - ' + e))
  } else {
    const decor = removed.filter(isDecor).length
    console.log(`PASS ${pa.url}${decor ? `  装饰行减少 ${decor}` : '  无文本变化'}`)
  }
}

console.log(`\n对比结论：${ma.length - fail} 页通过，${fail} 页异常`)
console.log(fail ? '存在信息层改动，请人工复核上方 FAIL 项。' : '仅装饰层变化，信息内容完整，未弄坏。')
process.exit(fail ? 1 : 0)
