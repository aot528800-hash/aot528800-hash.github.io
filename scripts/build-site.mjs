/**
 * 静态站点生成器
 * 把 App 里的政策数据渲染成一个可直接托管到 GitHub Pages 的网站。
 *
 * 运行：npm run build:site
 * 输出：site/
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { join } from 'node:path'
import { marked } from 'marked'
import { annualSchedule, policyCategories } from '../src/data/policies.js'
import { relatedPolicies, relationReason } from '../src/lib/policy.js'

marked.setOptions({ gfm: true, breaks: true })

// 资助中心业务数据（由 学生资助管理中心业务全景总表.xlsx 导出）
const CENTER = JSON.parse(readFileSync('src/data/center.json', 'utf8'))
const CENTER_KEYS = Object.keys(CENTER)
const [BIZ_LIST, BIZ_DIST, BIZ_RHYTHM, BIZ_ARCHIVE, BIZ_RISK] = CENTER_KEYS.map((k) => CENTER[k])

const OUT = 'site'
const SITE = {
  name: 'CQPUE资助政策',
  tagline: '把学生资助政策讲清楚',
  desc: '重庆工程职业技术大学学生资助政策的结构化整理：21 个资助项目，含资格条件、办理流程、时间节点与材料清单。',
  author: '周泽维',
  phone: '15736152295',
  updated: '2026 年 10 月 24 日',
  overridesNote: true,
  verified: '2026 年 10 月 24 日',
  verifiedShort: '2026-10-24',
  reviewBy: '2027 年 9 月',
  // 部署到 GitHub Pages 后把这里改成实际地址，例如 https://用户名.github.io/仓库名
  url: 'https://aot528800-hash.github.io',
  wechat: {
    id: '停不下来的独行侠',
    // 把二维码图片放进 assets/wechat/ 即可自动出现在网页上
    // 文件名含 dev / 开发 的标为「加我微信」，含 mp / 公众号 的标为「公众号」
    dir: 'assets/wechat',
  },
  apk: {
    version: '0.3.3',
    versionCode: 15,
    size: '3.1 MB',
    platform: 'Android 7.0 及以上',
    url: 'https://github.com/aot528800-hash/aot528800-hash.github.io/releases/latest/download/cqpue-aid.apk',
    sha256: '711085978F95CFFB22CA0A78288DF0A600AD8DE9B3785D918EFF259E7E2DD28E',
    contact: '15736152295',
  },
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// 站点层修正（不改 App 的 policies.js，只影响网页输出）
// 依据：学生资助管理中心业务全景总表 将其归入「四、校内及社会奖助学金」，依据为「捐资方协议」
const POLICY_OVERRIDES = {
  'zhumeng-scholarship': {
    subtitle: '4000元/年 · 中国教育发展基金会项目',
  },
  'president-honor': {
    subtitle: '个人 1 万 · 团队 1.5–2 万',
  },
}

const byId = (id) => policyCategories.find((p) => p.id === id)

// 资助中心全年节奏（业务总表第 3 页）
const RHYTHM_ROWS = BIZ_RHYTHM.slice(2).filter((r) => r[0] && !String(r[0]).startsWith('说明'))

// 从「9月-10月」「7月、10月」「暑期」这类标签里取出月份
function monthsOf(label) {
  const text = String(label)
  if (/暑期|暑假/.test(text) && !/\d/.test(text)) return [7, 8]
  return [...new Set([...text.matchAll(/(\d{1,2})/g)].map((m) => Number(m[1])).filter((n) => n >= 1 && n <= 12))]
}

// 学年视图：9 月 → 次年 8 月
const MONTH_ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]

// 从 21 条审批链里抽出资助中心自己要做的步骤（学生看不到的那部分）
const CENTER_ROLE = /中心|学生处/
const CENTER_ACTIONS = [] // { month, policy, title, desc }
for (const p of policyCategories) {
  const centerSteps = []
  for (const lvl of p.approvalChain || []) {
    if (!CENTER_ROLE.test(lvl.role || '')) continue
    for (const st of lvl.steps || []) centerSteps.push({ title: st.title, desc: st.desc || '' })
  }
  if (!centerSteps.length) continue
  const months = new Set()
  for (const t of p.timeline || []) for (const m of monthsOf(t.month)) months.add(m)
  for (const m of months) {
    for (const st of centerSteps) CENTER_ACTIONS.push({ month: m, policy: p.title, title: st.title, desc: st.desc })
  }
}
const CENTER_ACTION_TOTAL = CENTER_ACTIONS.length
const CENTER_ACTION_DISTINCT = new Set(CENTER_ACTIONS.map((a) => a.title)).size

function buildYearSchedule() {
  const map = new Map(MONTH_ORDER.map((m) => [m, { month: m, student: [], staff: [] }]))
  for (const s of annualSchedule) {
    for (const m of monthsOf(s.month)) {
      map.get(m)?.student.push(
        ...s.events.map((e) => {
          const d = String(e.desc || '').trim()
          // 只有表情符号的说明（如「⚠️」）不单独占一行
          const usable = /[\w\u4e00-\u9fa5]/.test(d) ? d : ''
          return { title: e.title, desc: usable }
        }),
      )
    }
  }
  for (const r of RHYTHM_ROWS) {
    for (const m of monthsOf(r[0])) {
      map.get(m)?.staff.push({ task: r[1], note: r[3] || r[2] || '', kind: 'task' })
    }
  }
  // 审批链里中心自己的动作，按月份挂上（同名去重）
  for (const a of CENTER_ACTIONS) {
    const bucket = map.get(a.month)
    if (!bucket) continue
    bucket.staff.push({ task: a.title, note: a.policy, kind: 'action' })
  }
  return MONTH_ORDER.map((m) => {
    const d = map.get(m)
    return { ...d, total: d.student.length + d.staff.length }
  })
}

for (const [id, patch] of Object.entries(POLICY_OVERRIDES)) {
  const target = policyCategories.find((p) => p.id === id)
  if (target) Object.assign(target, patch)
}
// 覆盖后重新计算分类，避免首页统计与卡片分组不一致
const CN_COUNT = policyCategories.filter((p) => p.tag === '国家政策').length
const SCH_COUNT = policyCategories.filter((p) => p.tag === '校内政策').length
const SOC_COUNT = policyCategories.filter((p) => p.tag === '社会捐资').length

/* ------------------------------------------------------------------ 信息架构 */

const GROUPS = [
  {
    title: '国家政策',
    desc: '中央与地方财政出资，覆盖奖、助、贷、补、免',
    items: policyCategories.filter((p) => p.tag === '国家政策'),
  },
  {
    title: '校内政策',
    desc: '学校自筹资金设立，按学年与学期评定。其中学习单项奖学金包含学习优胜、学习进步、交换生专项三项，已分别列出。',
    items: policyCategories.filter((p) => p.tag === '校内政策'),
  },
  {
    title: '社会捐资',
    desc: '由企业或基金会捐资设立、学校组织评审，非财政拨款。标准与名额以捐资方当年协议和学校通知为准。',
    items: policyCategories.filter((p) => p.tag === '社会捐资'),
  },
]

const MINDMAP = [
  {
    label: '国家政策',
    color: '#0071e3',
    groups: [
      { label: '奖优', ids: ['national-scholarship', 'encouragement-scholarship'] },
      { label: '助困', ids: ['national-grant'] },
      { label: '助学贷款', ids: ['student-loan'] },
      { label: '服兵役', ids: ['military-compensation', 'military-tuition-waiver', 'military-grant'] },
      { label: '基层就业', ids: ['grassroots-compensation'] },
      { label: '入学与认定', ids: ['green-channel', 'difficulty-assessment'] },
    ],
  },
  {
    label: '校内政策',
    color: '#af52de',
    groups: [
      { label: '奖学金', ids: ['president-honor', 'comprehensive-scholarship', 'excellence-scholarship', 'progress-scholarship', 'exchange-scholarship'] },
      { label: '减免与补助', ids: ['tuition-waiver', 'freshman-subsidy', 'temporary-subsidy', 'holiday-subsidy'] },
      { label: '勤工助学', ids: ['work-study'] },
    ],
  },
  {
    label: '社会捐资',
    color: '#f59e0b',
    groups: [{ label: '基金会项目', ids: ['zhumeng-scholarship'] }],
  },
]

const FLOW = [
  { t: '学生提交申请', d: '学工系统线上填表，无需开具任何证明' },
  { t: '班级民主评议', d: '评议小组按条件排序，名单班级公示' },
  { t: '学院审核公示', d: '学院资助工作组审核，公示不少于 3 日' },
  { t: '学校审定公示', d: '资助中心复核，全校公示不少于 5 个工作日' },
  { t: '资金发放', d: '按月或一次性转入学生本人银行卡' },
]

/* ------------------------------------------------------------------ 样式 */

const CSS = `
:root {
  --bg: #ffffff;
  --bg-alt: #f5f5f7;
  --card: #ffffff;
  --text: #1d1d1f;
  --text-2: #6e6e73;
  --text-3: #86868b;
  --line: #d2d2d7;
  --line-2: #e8e8ed;
  --accent: #0071e3;
  --accent-2: #0077ed;
  --green: #2e9e4f;
  --red: #d70015;
  --purple: #8e44ad;
  --radius: 18px;
  --radius-sm: 12px;
  --max: 1200px;
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
    "PingFang SC", "HarmonyOS Sans SC", "MiSans", "Noto Sans SC", "Microsoft YaHei",
    system-ui, sans-serif;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000;
    --bg-alt: #0a0a0a;
    --card: #1d1d1f;
    --text: #f5f5f7;
    --text-2: #a1a1a6;
    --text-3: #86868b;
    --line: #2d2d2f;
    --line-2: #242426;
    --accent: #2997ff;
    --accent-2: #4aa8ff;
    --green: #30d158;
    --red: #ff453a;
    --purple: #bf5af2;
  }
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 17px;
  line-height: 1.55;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

img, svg { max-width: 100%; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 3px; }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 6px;
}

.skip {
  position: absolute; left: -9999px; top: 0; z-index: 999;
  background: var(--text); color: var(--bg); padding: 10px 16px; border-radius: 8px;
}
.skip:focus { left: 16px; top: 12px; }

.wrap { max-width: var(--max); margin: 0 auto; padding: 0 32px; }

/* ---------- 导航 ---------- */
.nav {
  position: sticky; top: 0; z-index: 100;
  height: 56px;
  display: flex; align-items: center;
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--line-2);
}
@supports not (background: color-mix(in srgb, red 50%, transparent)) {
  .nav { background: var(--bg); opacity: .98; }
}
.nav .wrap { display: flex; align-items: center; gap: 28px; width: 100%; }
.nav-brand {
  display: flex; align-items: center; gap: 8px;
  font-weight: 600; font-size: 15px; color: var(--text); letter-spacing: -0.02em;
}
.nav-brand svg { width: 22px; height: 22px; }
.nav-links { display: flex; gap: 24px; margin-left: auto; }
.nav-links a { color: var(--text-2); font-size: 13.5px; }
.nav-links a:hover { color: var(--text); text-decoration: none; }
.nav-links a[aria-current="page"] { color: var(--text); font-weight: 500; }
.nav-cta {
  display: inline-flex; align-items: center; gap: 6px;
  height: 30px; padding: 0 14px; border-radius: 15px;
  background: var(--accent); color: #fff;
  font-size: 12.5px; font-weight: 500; white-space: nowrap;
  transition: background .18s ease;
}
.nav-cta svg { width: 14px; height: 14px; }
.nav-cta:hover { background: var(--accent-2); text-decoration: none; }
@media (max-width: 900px) { .nav-cta { display: none; } }
@media (max-width: 720px) { .nav-links { display: none; } }

/* ---------- 适用范围提示条 ---------- */
.scope-bar {
  background: var(--bg-alt);
  border-bottom: 1px solid var(--line-2);
  font-size: 12px; color: var(--text-3);
}
.scope-bar .wrap {
  display: flex; align-items: center; gap: 8px;
  height: 34px; flex-wrap: nowrap; overflow: hidden;
}
.scope-bar strong { color: var(--text-2); font-weight: 600; }
.scope-bar .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--line); flex: none; }
.scope-bar a { margin-left: auto; color: var(--text-2); white-space: nowrap; }
.scope-bar a:hover { color: var(--accent); }
@media (max-width: 640px) { .scope-bar .wrap { gap: 6px; font-size: 11px; } }

.scope-inline {
  margin: 12px 0 10px; font-size: 12.5px; color: var(--text-3);
}

/* ---------- 通用 ---------- */
section { padding: 112px 0; scroll-margin-top: 64px; }
[id] { scroll-margin-top: 64px; }
section.alt { background: var(--bg-alt); }
@media (max-width: 720px) { section { padding: 64px 0; } }

.eyebrow {
  font-size: 13px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: var(--accent); margin: 0 0 12px;
}
h2 { font-size: clamp(26px, 3.4vw, 40px); line-height: 1.12; letter-spacing: -0.025em; margin: 0 0 12px; font-weight: 700; }
.lede { font-size: clamp(17px, 1.6vw, 21px); color: var(--text-2); max-width: 62ch; margin: 0 0 40px; }

/* ---------- Hero ---------- */
.hero { padding: clamp(72px, 12vw, 132px) 0 clamp(64px, 10vw, 108px); text-align: center; }
.hero h1 {
  font-size: clamp(44px, 7.4vw, 96px);
  line-height: 1.03; letter-spacing: -0.04em; font-weight: 700;
  margin: 0 auto 20px; max-width: 18ch;
}
.hero p {
  font-size: clamp(17px, 2vw, 23px); line-height: 1.42; color: var(--text-2);
  max-width: 46ch; margin: 0 auto 34px;
}
.hero-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 46px; padding: 0 22px; border-radius: 980px;
  font-size: 16px; font-weight: 500; letter-spacing: -0.01em;
  background: var(--accent); color: #fff; border: none; cursor: pointer;
  transition: background .2s ease, transform .2s ease;
}
.btn:hover { background: var(--accent-2); text-decoration: none; }
.btn:active { transform: scale(.98); }
.btn.ghost { background: transparent; color: var(--accent); border: 1px solid var(--line); }
.btn.ghost:hover { background: var(--bg-alt); }

.stats {
  display: grid; grid-template-columns: repeat(5, 1fr);
  margin-top: 64px;
}
.stats > div {
  padding: 4px 12px; text-align: center;
  border-left: 1px solid var(--line-2);
}
.stats > div:first-child { border-left: none; }
.stats b { display: block; font-size: clamp(28px, 3.4vw, 40px); letter-spacing: -0.035em; font-weight: 700; }
.stats span { font-size: 12.5px; color: var(--text-2); }
@media (max-width: 720px) { .stats { grid-template-columns: repeat(3, 1fr); } .stats > div:nth-child(3n+1) { border-left: none; } }

/* ---------- 卡片 ---------- */
.grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.card {
  display: flex; gap: 14px; align-items: flex-start;
  background: var(--card); border: 1px solid var(--line-2);
  border-radius: var(--radius); padding: 20px;
  color: inherit; transition: transform .25s cubic-bezier(.32,.72,0,1), box-shadow .25s, border-color .25s;
}
.card:hover {
  text-decoration: none; transform: translateY(-2px);
  border-color: var(--line);
  box-shadow: 0 12px 32px rgba(0,0,0,.08);
}
.card .tile {
  flex: none; width: 42px; height: 42px; border-radius: 11px;
  display: grid; place-items: center; font-size: 21px;
}
.card h3 { margin: 2px 0 4px; font-size: 17px; letter-spacing: -0.02em; font-weight: 600; }
.card p { margin: 0; font-size: 13.5px; line-height: 1.45; color: var(--text-2); }
.card .badge {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 10px; padding: 3px 9px; border-radius: 999px;
  background: var(--bg-alt); color: var(--text-2);
  font-size: 11px; font-weight: 500;
}
.badge::before {
  content: ""; width: 5px; height: 5px; border-radius: 50%;
  background: var(--line); flex: none;
}
.badge.n::before { background: #0071e3; }
.badge.s::before { background: #8e44ad; }
.badge.soc::before { background: #f59e0b; }

/* ---------- 下载 ---------- */
.dl-section { padding: 96px 0; }
.dl-wrap {
  display: grid; grid-template-columns: 1fr 380px;
  gap: 72px; align-items: center;
}
@media (max-width: 900px) { .dl-wrap { grid-template-columns: 1fr; gap: 36px; } }

.dl-text h2 { margin-bottom: 12px; }
.dl-req { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 14.5px; color: var(--text-2); }
.dl-req li { display: flex; gap: 10px; line-height: 1.55; }
.dl-req strong { color: var(--text); font-weight: 600; }
.dl-req .ok, .dl-req .no, .dl-req .dot-i {
  flex: none; width: 18px; height: 18px; border-radius: 50%;
  display: grid; place-items: center; font-size: 10px; font-weight: 700;
  margin-top: 3px; color: #fff;
}
.dl-req .ok { background: var(--green); }
.dl-req .no { background: var(--red); }
.dl-req .dot-i { background: var(--line); }

.dl-card {
  background: var(--card); border: 1px solid var(--line-2);
  border-radius: 22px; padding: 26px;
}
.dl-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.dl-icon { width: 46px; height: 46px; border-radius: 12px; overflow: hidden; display: block; }
.dl-icon svg { width: 100%; height: 100%; display: block; }
.dl-card-head strong { display: block; font-size: 16px; letter-spacing: -.01em; }
.dl-card-head span { font-size: 12.5px; color: var(--text-3); }

.dl-meta { margin: 0 0 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; }
.dl-meta div { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--line-2); padding-bottom: 8px; }
.dl-meta dt { font-size: 12.5px; color: var(--text-3); }
.dl-meta dd { margin: 0; font-size: 13.5px; font-weight: 500; }

.dl-btn { width: 100%; height: 46px; }
.dl-btn svg { width: 17px; height: 17px; }
.dl-hash { margin: 12px 0 0; font-size: 11.5px; color: var(--text-3); font-family: ui-monospace, Menlo, Consolas, monospace; word-break: break-all; }
.dl-alt { margin: 14px 0 0; font-size: 12.5px; line-height: 1.6; color: var(--text-3); }

/* ---------- 搜索 ---------- */
.search-bar { position: relative; max-width: 520px; margin: 0 0 32px; }
.search-bar input {
  width: 100%; height: 46px; padding: 0 44px 0 44px;
  font-size: 16px; font-family: inherit; color: var(--text);
  background: var(--bg-alt); border: 1px solid var(--line-2); border-radius: 12px;
  outline: none; transition: border-color .2s, background .2s;
}
.search-bar input:focus { border-color: var(--accent); background: var(--card); }
.search-bar .ic { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--text-3); }
.search-bar .clr { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: none; background: none; color: var(--text-3); cursor: pointer; border-radius: 50%; font-size: 16px; }
.empty { padding: 40px 0; color: var(--text-3); font-size: 15px; }

/* ---------- 思维导图 ---------- */
.map-frame {
  background: var(--card); border: 1px solid var(--line-2); border-radius: var(--radius);
  padding: 12px; overflow: auto;
}
.map-frame svg { display: block; min-width: 720px; width: 100%; height: auto; }
.map-hint { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; font-size: 13px; color: var(--text-3); flex-wrap: wrap; }

.deps { margin-top: 20px; padding: 18px 20px; background: var(--bg-alt); border-radius: var(--radius); }
.deps-label { font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); margin-bottom: 10px; }
.deps-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.deps-row a { font-size: 13.5px; padding: 6px 12px; border-radius: 8px; background: var(--card); border: 1px solid var(--line-2); color: var(--text); }
.deps-row a:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }
.dep-from { font-weight: 600; }
.dep-arrow { color: var(--text-3); }
.deps p { margin: 10px 0 0; font-size: 12.5px; color: var(--text-3); }

/* ---------- 流程 ---------- */
.flow { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; counter-reset: step; }
.flow > li {
  list-style: none; position: relative; background: var(--card);
  border: 1px solid var(--line-2); border-radius: var(--radius-sm); padding: 18px 16px;
}
.flow > li::before {
  counter-increment: step; content: counter(step);
  display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;
  background: var(--accent); color: #fff; font-size: 12px; font-weight: 700; margin-bottom: 10px;
}
.flow h4 { margin: 0 0 4px; font-size: 14.5px; font-weight: 600; letter-spacing: -0.01em; }
.flow p { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--text-2); }
@media (max-width: 900px) { .flow { grid-template-columns: 1fr 1fr; } }
@media (max-width: 520px) { .flow { grid-template-columns: 1fr; } }

/* ---------- 时间轴 ---------- */
.timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
.timeline li {
  display: grid; grid-template-columns: 110px 1fr; gap: 20px;
  padding: 18px 0; border-top: 1px solid var(--line-2);
}
.timeline li:last-child { border-bottom: 1px solid var(--line-2); }
.timeline .m { font-size: 14px; font-weight: 600; color: var(--accent); font-variant-numeric: tabular-nums; }
.timeline .e { display: grid; gap: 6px; }
.timeline .e div { font-size: 15px; }
.timeline .e span { font-size: 12.5px; color: var(--text-2); }
@media (max-width: 560px) { .timeline li { grid-template-columns: 76px 1fr; gap: 12px; } }

/* ---------- 全年负荷 ---------- */
.load-bars {
  display: grid; grid-template-columns: repeat(12, 1fr);
  gap: 8px; align-items: end;
  height: 168px; margin: 8px 0 26px;
  padding-bottom: 26px; position: relative;
  border-bottom: 1px solid var(--line-2);
}
.lb-col {
  display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
  height: 100%; position: relative;
}
.lb-col i {
  display: block; width: 100%; max-width: 46px; border-radius: 6px 6px 0 0;
  background: var(--line);
  transition: background .2s ease;
}
.lb-col[data-level="mid"] i { background: #7fb2e8; }
.lb-col[data-level="high"] i { background: var(--accent); }
.lb-count { font-size: 11px; color: var(--text-3); margin-bottom: 4px; font-variant-numeric: tabular-nums; }
.lb-month { position: absolute; bottom: -22px; font-size: 11.5px; color: var(--text-3); white-space: nowrap; }
.lb-col[data-level="high"] .lb-month { color: var(--text); font-weight: 600; }

.month-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 1080px) { .month-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 680px) { .month-grid { grid-template-columns: 1fr; } }

.month-card {
  border: 1px solid var(--line-2); border-radius: var(--radius);
  padding: 16px 18px; background: var(--card);
}
.month-card[data-level="high"] { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0,113,227,.08); }
.month-card header {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 10px; margin-bottom: 12px; padding-bottom: 10px;
  border-bottom: 1px solid var(--line-2);
}
.month-card header b { font-size: 16px; letter-spacing: -.01em; }
.month-total { font-size: 11.5px; color: var(--text-3); }
.month-card[data-level="high"] .month-total { color: var(--accent); font-weight: 600; }

.m-block + .m-block { margin-top: 12px; }
.m-label { font-size: 11px; font-weight: 600; letter-spacing: .04em; margin-bottom: 6px; }
.m-label--staff { color: #b25000; }
.m-label--student { color: var(--text-3); }
@media (prefers-color-scheme: dark) { .m-label--staff { color: #ffb340; } }

.month-card ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.month-card li {
  font-size: 13px; line-height: 1.5; padding-left: 11px; position: relative;
}
.month-card li::before {
  content: ""; position: absolute; left: 0; top: 7px;
  width: 4px; height: 4px; border-radius: 50%; background: var(--line);
}
.month-card li span { display: block; font-size: 11.5px; color: var(--text-3); margin-top: 1px; }
.month-card li.is-action::before { background: #ff9f0a; }
.month-card li.more { color: var(--text-3); font-style: normal; }
.month-card li.more::before { background: transparent; }
.m-empty { margin: 0; font-size: 12.5px; color: var(--text-3); }
.schedule-note { margin: 22px 0 0; font-size: 12px; line-height: 1.7; color: var(--text-3); max-width: 92ch; }

/* ---------- 全年分析 ---------- */
.analysis { margin-top: 56px; padding-top: 40px; border-top: 1px solid var(--line-2); }
.analysis h3 { margin: 0 0 20px; font-size: 24px; letter-spacing: -.02em; }

.an-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 32px; }
@media (max-width: 1080px) { .an-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .an-grid { grid-template-columns: 1fr; } }
.an-card { padding: 18px; border: 1px solid var(--line-2); border-radius: 14px; background: var(--card); }
.an-card b { display: block; font-size: 30px; letter-spacing: -.03em; font-weight: 700; line-height: 1.1; }
.an-card span { display: block; margin: 6px 0 8px; font-size: 12px; color: var(--text-3); }
.an-card p { margin: 0; font-size: 13px; line-height: 1.6; color: var(--text-2); }

.pareto { margin: 0 0 26px; padding: 20px 20px 8px; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--card); }
.pareto figcaption { font-size: 13px; color: var(--text-3); margin-bottom: 10px; }
.pareto-svg { display: block; width: 100%; height: auto; }
.pf-bar { fill: var(--accent); }
.pf-line { fill: none; stroke: #ff9f0a; stroke-width: 2; }
.pf-dot { fill: #ff9f0a; }
.pf-num { font-size: 11px; fill: var(--text-3); }
.pf-month { font-size: 11.5px; fill: var(--text); }
.pf-cum { font-size: 11px; fill: #b25000; font-weight: 600; }
.pf-axis { stroke: var(--line); stroke-width: 1; }
.pf-guide { stroke: #ff9f0a; stroke-width: 1; stroke-dasharray: 4 4; opacity: .5; }
.pf-guide-label { font-size: 10.5px; fill: #b25000; }
@media (prefers-color-scheme: dark) { .pf-cum, .pf-guide-label { fill: #ffb340; } }
.pf-note { margin: 0; font-size: 12px; color: var(--text-3); line-height: 1.6; }

.an-conclusion {
  padding: 18px 20px; border-radius: 14px; background: var(--bg-alt);
  font-size: 14px; line-height: 1.75; color: var(--text-2);
}
.an-conclusion strong { color: var(--text); }
.an-conclusion em { font-style: normal; color: var(--accent); font-weight: 600; }
.an-link { display: inline-block; margin-top: 10px; font-size: 13.5px; }

/* ---------- 详情页 ---------- */
.page-head { padding: 56px 0 28px; border-bottom: 1px solid var(--line-2); }
.crumb { font-size: 13px; color: var(--text-3); margin-bottom: 14px; }
.crumb a { color: var(--text-3); }
.crumb a:hover { color: var(--accent); }
.page-head h1 { font-size: clamp(30px, 4.6vw, 46px); line-height: 1.08; letter-spacing: -0.03em; margin: 0 0 8px; }
.page-head .sub { font-size: 17px; color: var(--text-2); margin: 0 0 14px; }
.meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-3); }
.meta span { padding: 3px 9px; border-radius: 6px; background: var(--bg-alt); }

.layout { display: grid; grid-template-columns: minmax(0, 780px) 248px; gap: 64px; justify-content: space-between; padding: 48px 0 104px; }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; gap: 0; } .toc { display: none; } }

.toc { position: sticky; top: 84px; align-self: start; font-size: 13.5px; }
.toc strong { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3); margin-bottom: 10px; }
.toc a { display: block; padding: 6px 0; color: var(--text-2); border-left: 2px solid transparent; padding-left: 12px; }
.toc a:hover { color: var(--text); text-decoration: none; }
.toc a:active { opacity: .6; }
.toc a.active { color: var(--accent); border-left-color: var(--accent); font-weight: 500; }

.block { margin-bottom: 52px; scroll-margin-top: 76px; }
.block > h2 { font-size: 22px; letter-spacing: -0.02em; margin: 0 0 16px; }
.block > h2 .num { color: var(--text-3); font-weight: 500; margin-right: 8px; }

.cond { display: grid; gap: 8px; }
.cond li { list-style: none; display: flex; gap: 10px; font-size: 15px; line-height: 1.5; }
.cond .mark { flex: none; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #fff; margin-top: 2px; }
.cond .mark.y { background: var(--green); }
.cond .mark.n { background: var(--red); }
.cond ul { margin: 0; padding: 0; display: grid; gap: 8px; }

.prose { font-size: 16.5px; line-height: 1.72; color: var(--text); max-width: 72ch; }
.prose > *:first-child { margin-top: 0; }
.prose h3 { font-size: 18px; margin: 26px 0 8px; letter-spacing: -0.015em; }
.prose p { margin: 12px 0; }
.prose ul, .prose ol { margin: 12px 0; padding-left: 22px; }
.prose li { margin: 5px 0; }
.prose strong { font-weight: 650; }
.prose table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px; }
.prose th { text-align: left; font-weight: 600; color: var(--text-2); padding: 9px 10px; border-bottom: 1px solid var(--line); }
.prose td { padding: 9px 10px; border-bottom: 1px solid var(--line-2); vertical-align: top; }
.prose blockquote { margin: 16px 0; padding: 12px 16px; background: var(--bg-alt); border-radius: 12px; font-size: 14.5px; color: var(--text-2); }
.prose blockquote p { margin: 4px 0; }
.prose code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 14px; background: var(--bg-alt); padding: 1px 6px; border-radius: 5px; }

.steps { display: grid; gap: 0; }
.steps .role { margin: 22px 0 10px; font-size: 14px; font-weight: 600; color: var(--text-2); }
.steps .role:first-child { margin-top: 0; }
.steps ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; }
.steps li { display: flex; gap: 12px; }
.steps .n { flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; margin-top: 2px; }
.steps h4 { margin: 0 0 2px; font-size: 15px; font-weight: 600; }
.steps p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--text-2); }
.steps .pub { margin-top: 6px; font-size: 12.5px; color: #a05a00; }
@media (prefers-color-scheme: dark) { .steps .pub { color: #ffb340; } }

.mats { display: grid; gap: 1px; background: var(--line-2); border-radius: var(--radius-sm); overflow: hidden; }
.mats div { background: var(--card); padding: 13px 16px; display: flex; gap: 12px; align-items: flex-start; }
.mats .nm { font-size: 15px; }
.mats .nt { font-size: 12.5px; color: var(--text-2); margin-top: 2px; }
.mats .tag { margin-left: auto; flex: none; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 6px; }
.mats .tag.r { color: var(--red); background: rgba(215,0,21,.1); }
.mats .tag.o { color: var(--green); background: rgba(46,158,79,.12); }

.rel { display: grid; gap: 10px; }
.rel a { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--line-2); border-radius: var(--radius-sm); color: inherit; }
.rel a:hover { border-color: var(--line); text-decoration: none; }
.rel .t { font-size: 15px; }
.rel .s { font-size: 12.5px; color: var(--text-2); }
.rel .why { margin-left: auto; font-size: 12px; color: var(--text-3); white-space: nowrap; }

.pager { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid var(--line-2); padding: 24px 0 0; font-size: 14px; }
.pager a { color: var(--accent); }

/* ---------- 免责声明 ---------- */
.wrap.narrow { max-width: 940px; }
.disc-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 20px 40px;
  margin: 8px 0 28px;
}
@media (max-width: 760px) { .disc-grid { grid-template-columns: 1fr; gap: 18px; } }
.disc-item h3 { margin: 0 0 6px; font-size: 16px; letter-spacing: -.01em; }
.disc-item p { margin: 0; font-size: 14.5px; line-height: 1.65; color: var(--text-2); }
.disc-foot {
  margin: 0; padding-top: 18px; border-top: 1px solid var(--line-2);
  font-size: 13px; color: var(--text-3);
}

/* ---------- 作者 ---------- */
.author { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
@media (max-width: 820px) { .author { grid-template-columns: 1fr; gap: 28px; } }
.author h2 { margin-bottom: 16px; }
.author p { color: var(--text-2); font-size: 15.5px; line-height: 1.7; }
.author dl { display: grid; grid-template-columns: 84px 1fr; gap: 10px 16px; margin: 0; font-size: 14.5px; }
.author dt { color: var(--text-3); }
.author dd { margin: 0; }

/* ---------- 联系开发者 ---------- */
.contact { margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--line-2); }
.contact-head { font-size: 13px; font-weight: 600; letter-spacing: .04em; color: var(--text-3); margin-bottom: 14px; }
.qr-row { display: flex; gap: 24px; flex-wrap: wrap; }
.qr-card { margin: 0; text-align: center; }
.qr-card img {
  display: block; width: 168px; height: 168px;
  border-radius: 14px; background: #fff; padding: 8px;
  border: 1px solid var(--line-2);
}
.qr-card figcaption { margin-top: 10px; display: grid; gap: 2px; }
.qr-card figcaption strong { font-size: 13.5px; font-weight: 600; }
.qr-card figcaption span { font-size: 12px; color: var(--text-3); }
.contact-id { margin: 16px 0 0; font-size: 14px; color: var(--text-2); }
.contact-id strong { color: var(--text); font-weight: 600; }

@media print { .contact { break-inside: avoid; } }

/* ---------- 页脚 ---------- */
footer { border-top: 1px solid var(--line-2); padding: 48px 0 72px; font-size: 12.5px; line-height: 1.7; color: var(--text-3); }
footer .wrap { display: grid; gap: 12px; max-width: 980px; }
footer a { color: var(--text-2); }
footer .links { display: flex; gap: 20px; flex-wrap: wrap; }

/* ---------- 入场动效 ---------- */
.reveal { opacity: 0; transform: translateY(14px); transition: opacity .7s cubic-bezier(.32,.72,0,1), transform .7s cubic-bezier(.32,.72,0,1); }
.reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; } }

/* ---------- 视觉收口 ---------- */
::selection { background: rgba(0,113,227,.18); }

h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; }

.hero {
  position: relative;
  background: radial-gradient(1000px 460px at 50% -18%, rgba(0,113,227,.06), transparent 62%);
}
@media (prefers-color-scheme: dark) {
  .hero { background: radial-gradient(1000px 460px at 50% -18%, rgba(41,151,255,.1), transparent 62%); }
}

.fresh-line {
  margin: 18px auto 0;
  font-size: 13px;
  color: var(--text-3);
  text-align: center;
}
.fresh-line::before {
  content: "";
  display: inline-block;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--green);
  margin-right: 7px;
  vertical-align: 1px;
  box-shadow: 0 0 0 3px rgba(46,158,79,.15);
}

.nav-links a[aria-current="page"] {
  color: var(--text);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 6px;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 2px;
}

.card {
  padding: 22px;
  border-radius: 20px;
}
.card .tile { width: 44px; height: 44px; border-radius: 12px; font-size: 22px; background: var(--bg-alt); }
.card:hover { border-color: var(--line); box-shadow: 0 10px 28px rgba(0,0,0,.06); transform: translateY(-1px); }
.card:active { transform: scale(.995); }

.section-tight { padding-top: 72px; }

/* ---------- 页面切换（View Transitions，支持的浏览器自动启用） ---------- */
@view-transition { navigation: auto; }
::view-transition-old(root) { animation: vt-out .16s ease both; }
::view-transition-new(root) { animation: vt-in .22s cubic-bezier(.32,.72,0,1) both; }
@keyframes vt-out { to { opacity: 0; } }
@keyframes vt-in { from { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root), ::view-transition-new(root) { animation: none; }
}

/* ---------- 详情页头部 ---------- */
.head-row { display: flex; align-items: flex-start; gap: 16px; }
.head-icon {
  flex: none; width: 56px; height: 56px; border-radius: 14px;
  display: grid; place-items: center; font-size: 30px;
  background: var(--bg-alt);
}
.head-text { flex: 1; min-width: 0; }
.head-row h1 { margin: 0 0 6px; }
.print-btn {
  flex: none; margin-left: auto;
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px; border-radius: 18px;
  border: 1px solid var(--line); background: var(--card);
  color: var(--text-2); font: inherit; font-size: 13.5px; cursor: pointer;
  transition: all .18s ease;
}
.print-btn svg { width: 16px; height: 16px; }
.print-btn:hover { border-color: var(--accent); color: var(--accent); }
@media (max-width: 560px) {
  .head-icon { width: 46px; height: 46px; font-size: 24px; }
  .print-btn { height: 34px; padding: 0 10px; font-size: 12.5px; }
}

.meta .fresh { color: var(--green); background: rgba(46,158,79,.1); }

.h2-note { font-size: 13px; font-weight: 400; color: var(--text-3); margin-left: 8px; }

/* ---------- 角色 ---------- */
.role-bar {
  margin: 26px 0 4px;
  padding: 18px 20px;
  background: var(--bg-alt);
  border: 1px solid var(--line-2);
  border-radius: var(--radius);
}
.role-bar-head {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 12px; flex-wrap: wrap; margin-bottom: 12px;
}
.rb-label { font-size: 14.5px; font-weight: 600; letter-spacing: -.01em; }
.rb-hint { font-size: 12.5px; color: var(--text-3); }

.role-chips {
  display: flex; gap: 8px; flex-wrap: wrap;
  padding-bottom: 4px;
}
@media (max-width: 720px) {
  .role-chips {
    flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
    -webkit-mask-image: linear-gradient(to right, #000 88%, transparent 100%);
    mask-image: linear-gradient(to right, #000 88%, transparent 100%);
  }
}
.role-chips::-webkit-scrollbar { display: none; }
.role-chip {
  flex: none; display: inline-flex; align-items: center; gap: 7px;
  height: 38px; padding: 0 14px; border-radius: 19px;
  border: 1px solid var(--line); background: var(--card);
  color: var(--text-2); font: inherit; font-size: 13.5px; cursor: pointer;
  transition: background .18s ease, color .18s ease, border-color .18s ease;
}
.role-chip:hover { border-color: var(--accent); color: var(--text); }
.role-chip.is-on { background: var(--accent); border-color: var(--accent); color: #fff; }
.role-chip:active { transform: scale(.97); }
.rc-icon { font-size: 15px; }
.rc-name { max-width: 148px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc-lv { font-size: 10.5px; opacity: .7; }

.role-summary { margin-top: 12px; font-size: 13.5px; color: var(--text-2); min-height: 20px; }

.roles { display: grid; gap: 14px; }
.role-block {
  padding: 18px 20px;
  background: var(--card);
  border: 1px solid var(--line-2);
  border-radius: var(--radius);
  transition: border-color .25s ease, box-shadow .25s ease;
}
.role-block.is-on {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0,113,227,.12);
}
.role-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.role-step {
  font-size: 11.5px; font-weight: 600; color: var(--accent);
  background: rgba(0,113,227,.1); padding: 2px 8px; border-radius: 6px;
}
.role-head h3 { margin: 0; font-size: 17px; letter-spacing: -.01em; }
.role-count { margin-left: auto; font-size: 12px; color: var(--text-3); }

.role-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.role-steps li { display: flex; gap: 12px; }
.role-steps .n {
  flex: none; width: 22px; height: 22px; border-radius: 50%;
  background: var(--accent); color: #fff; font-size: 11px; font-weight: 700;
  display: grid; place-items: center; margin-top: 2px;
}
.role-steps h4 { margin: 0 0 2px; font-size: 15px; }
.role-steps p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--text-2); }

.role-pub {
  margin: 12px 0 0; padding: 8px 12px; border-radius: 8px;
  background: rgba(255,149,0,.1); font-size: 12.5px; color: #a05a00;
}
@media (prefers-color-scheme: dark) { .role-pub { color: #ffb340; } }

/* ---------- 资助中心 ---------- */
.center-stats {
  display: grid; grid-template-columns: repeat(4, 1fr);
  margin: 28px 0 8px; padding: 0 0 24px;
  border-bottom: 1px solid var(--line-2);
}
.center-stats > div { text-align: center; border-left: 1px solid var(--line-2); }
.center-stats > div:first-child { border-left: none; }
.center-stats b { display: block; font-size: 34px; letter-spacing: -.03em; font-weight: 700; }
.center-stats span { font-size: 12.5px; color: var(--text-2); }

.block-lede { margin: -4px 0 20px; font-size: 14.5px; color: var(--text-2); max-width: 78ch; }

.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.cat-card {
  display: block; padding: 16px 18px; border: 1px solid var(--line-2);
  border-radius: 14px; color: inherit; background: var(--card);
  transition: border-color .2s ease, transform .2s ease;
}
.cat-card:hover { border-color: var(--accent); text-decoration: none; transform: translateY(-1px); }
.cat-name { font-size: 14px; font-weight: 500; margin-bottom: 8px; }
.cat-num { font-size: 12.5px; color: var(--text-3); display: flex; align-items: baseline; gap: 6px; }
.cat-num strong { font-size: 22px; color: var(--text); font-weight: 700; letter-spacing: -.02em; }
.cat-num span { margin-left: auto; }
.cat-bar { margin-top: 10px; height: 3px; border-radius: 2px; background: var(--line-2); overflow: hidden; }
.cat-bar i { display: block; height: 100%; background: var(--accent); border-radius: 2px; }

.cat-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px; }
.cat-chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px; border-radius: 16px;
  border: 1px solid var(--line); background: var(--card);
  color: var(--text-2); font: inherit; font-size: 13px; cursor: pointer;
  transition: all .18s ease;
}
.cat-chip span { font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.cat-chip:hover { border-color: var(--accent); color: var(--text); }
.cat-chip.is-on { background: var(--accent); border-color: var(--accent); color: #fff; }
.cat-chip.is-on span { color: rgba(255,255,255,.75); }

.biz-wrap { display: grid; gap: 34px; }
.biz-group-head {
  display: flex; align-items: baseline; gap: 10px;
  margin: 0 0 14px; font-size: 17px; letter-spacing: -.01em;
  padding-bottom: 10px; border-bottom: 1px solid var(--line-2);
}
.biz-group-head span { font-size: 12.5px; color: var(--text-3); font-weight: 400; }

.biz-row { display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px dashed var(--line-2); }
.biz-row:last-child { border-bottom: none; }
.biz-no {
  flex: none; width: 28px; height: 28px; border-radius: 8px;
  background: var(--bg-alt); color: var(--text-3);
  display: grid; place-items: center; font-size: 12px; font-weight: 600;
  font-variant-numeric: tabular-nums; margin-top: 1px;
}
.biz-body { min-width: 0; }
.biz-title { font-size: 15.5px; font-weight: 600; letter-spacing: -.01em; margin-bottom: 4px; }
.biz-desc { margin: 0 0 8px; font-size: 14px; line-height: 1.6; color: var(--text-2); max-width: 88ch; }
.biz-meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 11.5px; }
.biz-freq { color: var(--accent); background: rgba(0,113,227,.1); padding: 2px 8px; border-radius: 6px; }
.biz-basis { color: var(--text-3); background: var(--bg-alt); padding: 2px 8px; border-radius: 6px; }

.rhythm .e { display: grid; gap: 6px; }
.rhythm-cat { font-size: 12px; color: var(--text-3); }
.rhythm-note { font-size: 12.5px; color: var(--text-2); }

.risk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 900px) { .risk-grid { grid-template-columns: 1fr; } }
.risk-item { border: 1px solid var(--line-2); border-radius: 14px; padding: 16px 18px; background: var(--card); }
.risk-cat {
  display: inline-block; font-size: 11.5px; font-weight: 600;
  color: #a05a00; background: rgba(255,149,0,.12);
  padding: 2px 8px; border-radius: 6px; margin-bottom: 10px;
}
@media (prefers-color-scheme: dark) { .risk-cat { color: #ffb340; } }
.risk-desc { margin: 0 0 10px; font-size: 14px; line-height: 1.6; }
.risk-fix { font-size: 13px; line-height: 1.6; color: var(--text-2); }
.risk-fix span {
  display: inline-block; font-size: 11px; font-weight: 600; color: var(--green);
  background: rgba(46,158,79,.12); padding: 1px 7px; border-radius: 5px; margin-right: 6px;
}

.archive-note {
  padding: 16px 18px; border-radius: 14px; background: var(--bg-alt);
  font-size: 14px; line-height: 1.65; color: var(--text-2);
}
.center-foot { margin: 8px 0 96px; font-size: 12px; color: var(--text-3); line-height: 1.7; }

/* ---------- 工作量说明 ---------- */
.workload {
  margin: 8px 0 56px; padding: 32px 0 8px;
  border-top: 1px solid var(--line-2);
}
.workload h2 { margin-bottom: 10px; }

.wl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 24px 0 34px; }
@media (max-width: 1000px) { .wl-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 620px) { .wl-grid { grid-template-columns: 1fr; } }
.wl-card { padding: 18px 20px; border: 1px solid var(--line-2); border-radius: 16px; background: var(--card); }
.wl-card b { display: block; font-size: 34px; line-height: 1.05; letter-spacing: -.035em; font-weight: 700; }
.wl-card span { display: block; margin: 6px 0 8px; font-size: 12.5px; color: var(--text-3); }
.wl-card p { margin: 0; font-size: 13px; line-height: 1.65; color: var(--text-2); }

.wl-sub { margin: 0 0 14px; font-size: 17px; letter-spacing: -.01em; }

.wl-flow {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  margin-bottom: 34px;
}
.wl-flow span {
  padding: 7px 12px; border-radius: 8px; background: var(--bg-alt);
  font-size: 13px; color: var(--text); white-space: nowrap;
}
.wl-flow i { color: var(--text-3); font-style: normal; font-size: 12px; }

.wl-compare { display: grid; gap: 1px; background: var(--line-2); border-radius: 14px; overflow: hidden; margin-bottom: 30px; }
.wl-row { display: grid; grid-template-columns: 220px 1fr; gap: 0; background: var(--card); }
@media (max-width: 680px) { .wl-row { grid-template-columns: 1fr; } }
.wl-row > div { padding: 13px 16px; font-size: 14px; line-height: 1.6; }
.wl-row > div:first-child { color: var(--text-3); }
.wl-row > div:last-child { color: var(--text); border-left: 1px solid var(--line-2); }
@media (max-width: 680px) { .wl-row > div:last-child { border-left: none; border-top: 1px solid var(--line-2); } }
.wl-row.wl-head > div { font-size: 12px; font-weight: 600; letter-spacing: .04em; color: var(--text-3); background: var(--bg-alt); }

.wl-close {
  padding: 22px 24px; border-radius: 16px;
  background: var(--bg-alt); border: 1px solid var(--line-2);
}
.wl-close p { margin: 0 0 10px; font-size: 14.5px; line-height: 1.75; color: var(--text-2); }
.wl-close p:last-of-type { margin-bottom: 14px; font-weight: 600; color: var(--text); }
.wl-note { margin: 0 !important; padding-top: 12px; border-top: 1px solid var(--line-2); font-size: 12px !important; font-weight: 400 !important; color: var(--text-3) !important; }

/* ---------- 打印 ---------- */
.print-head { display: none; }

@media print {
  @page { margin: 16mm 14mm 14mm; }

  .nav, .toc, .pager, .print-btn, .role-bar,
  .hero-actions, .search-bar, .map-frame, .map-hint, .deps,
  footer .links, .crumb { display: none !important; }

  .print-head {
    display: block;
    margin-bottom: 8mm;
    padding-bottom: 4mm;
    border-bottom: 1px solid #999;
  }
  .ph-title { font-size: 15pt; font-weight: 700; }
  .ph-meta { margin-top: 2mm; font-size: 8.5pt; color: #555; }

  body { font-size: 10.5pt; color: #000; background: #fff; }
  .wrap { max-width: none; padding: 0; }
  .layout { display: block; }
  .page-head, .block { break-inside: avoid; }
  h2, h3, h4 { break-after: avoid; }
  .block > h2 { margin-bottom: 4mm; }
  .block { margin-bottom: 8mm; }

  a { color: #000; text-decoration: none; }
  .role-block { border-color: #ccc; box-shadow: none !important; }
  .role-chip.is-on { background: #eee; color: #000; }
  .prose table { font-size: 9pt; }
}
`

/* ------------------------------------------------------------------ 交互脚本 */

const SITE_JS = `(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 搜索：按卡片文本过滤 */
  var q = document.getElementById('q');
  if (q) {
    var clear = document.getElementById('qclear');
    var cards = [].slice.call(document.querySelectorAll('#results .card'));
    var groups = [].slice.call(document.querySelectorAll('#results .group-block'));
    var none = document.getElementById('noresult');
    var hay = cards.map(function (c) { return (c.textContent || '').toLowerCase(); });

    function run() {
      var v = (q.value || '').trim().toLowerCase();
      clear.hidden = !v;
      var shown = 0;
      cards.forEach(function (c, i) {
        var hit = !v || hay[i].indexOf(v) !== -1;
        c.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      groups.forEach(function (g) {
        var any = [].slice.call(g.querySelectorAll('.card')).some(function (c) {
          return c.style.display !== 'none';
        });
        g.style.display = any ? '' : 'none';
      });
      none.hidden = shown > 0;
    }

    q.addEventListener('input', run);
    clear.addEventListener('click', function () { q.value = ''; run(); q.focus(); });
    run();
  }

  /* 目录：滚动到哪节高亮哪条 */
  var toc = document.querySelector('.toc');
  if (toc && 'IntersectionObserver' in window) {
    var links = [].slice.call(toc.querySelectorAll('a[href^="#"]'));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('active'); });
        if (map[e.target.id]) map[e.target.id].classList.add('active');
      });
    }, { rootMargin: '-90px 0px -65% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) obs.observe(el);
    });
  }

  /* 资助中心：按门类筛选 */
  var catChips = [].slice.call(document.querySelectorAll('.cat-chip'));
  if (catChips.length) {
    var catGroups = [].slice.call(document.querySelectorAll('.biz-group'));
    catChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var target = chip.getAttribute('data-cat');
        catChips.forEach(function (x) { x.classList.toggle('is-on', x === chip); });
        catGroups.forEach(function (g) {
          g.style.display = target === 'all' || g.getAttribute('data-cat') === target ? '' : 'none';
        });
      });
    });
  }

  /* 桌面快捷键：/ 聚焦搜索，Esc 清除 */
  var searchInput = document.getElementById('q');
  if (searchInput) {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      var typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInput.focus();
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.blur();
      }
    });
  }

  /* 角色：选中后高亮对应环节 */
  var chips = [].slice.call(document.querySelectorAll('.role-chip'));
  if (chips.length) {
    var blocks = [].slice.call(document.querySelectorAll('.role-block'));
    var summary = document.getElementById('roleSummary');

    function apply(i, scroll) {
      chips.forEach(function (c, j) {
        c.classList.toggle('is-on', j === i);
        c.setAttribute('aria-pressed', j === i ? 'true' : 'false');
      });
      blocks.forEach(function (b, j) { b.classList.toggle('is-on', j === i); });

      var b = blocks[i];
      if (b && summary) {
        var pub = b.querySelector('.role-pub');
        var n = b.querySelectorAll('.role-steps li').length;
        summary.textContent = b.querySelector('h3').textContent + ' · ' + n + ' 项任务' +
          (pub ? ' · ' + pub.textContent.replace('📣', '').trim() : '');
      }
      if (scroll && b) b.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    chips.forEach(function (c, i) {
      c.addEventListener('click', function () { apply(i, true); });
    });

    // 默认选中「学生本人」：按名称开头匹配，避免命中「财务处 + 学生资助管理中心」
    var student = 0;
    for (var i = 0; i < chips.length; i++) {
      var nm = (chips[i].querySelector('.rc-name') || chips[i]).textContent.trim();
      if (nm.indexOf('学生') === 0) { student = i; break; }
    }
    apply(student, false);
  }

  /* 打印：写入打印时间 */
  function stampPrintDate() {
    var d = new Date();
    var s = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    [].slice.call(document.querySelectorAll('.ph-date')).forEach(function (el) { el.textContent = s; });
  }
  stampPrintDate();
  window.addEventListener('beforeprint', stampPrintDate);

  /* 首页导航：滚动时高亮当前区块 */
  var navLinks = [].slice.call(document.querySelectorAll('.nav-links a')).filter(function (a) {
    var h = a.getAttribute('href');
    return h.charAt(0) === '#' && h !== '#top';
  });
  if (navLinks.length && 'IntersectionObserver' in window) {
    var ids = navLinks.map(function (a) { return a.getAttribute('href').slice(1); });
    var targets = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        [].slice.call(document.querySelectorAll('.nav-links a')).forEach(function (a) { a.removeAttribute('aria-current'); });
        var link = navLinks[ids.indexOf(e.target.id)];
        if (link) link.setAttribute('aria-current', 'page');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* 入场动效 */
  if (!reduce && 'IntersectionObserver' in window) {
    var targets = [].slice.call(document.querySelectorAll('.card, .flow > li, .timeline > li, .author > div'));
    targets.forEach(function (t, i) {
      t.classList.add('reveal');
      t.style.transitionDelay = (Math.min(i % 6, 5) * 40) + 'ms';
    });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  }
})();`

/* ------------------------------------------------------------------ 组件 */

const ICON_SHIELD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" aria-hidden="true">
  <rect width="200" height="200" rx="44" fill="#0071e3"/>
  <path d="M100 46 L74 57 L74 88 Q74 104 100 112 Q126 104 126 88 L126 57 Z" fill="#fff" opacity=".97"/>
  <path d="M44 132 Q54 112 76 119 Q88 123 93 135 L93 145 Q80 143 66 147 Q50 152 44 132Z" fill="#f59e0b"/>
  <path d="M156 132 Q146 112 124 119 Q112 123 107 135 L107 145 Q120 143 134 147 Q150 152 156 132Z" fill="#f97316"/>
  <path d="M100 130 Q94 121 94 116 Q94 110 100 110 Q106 110 106 116 Q106 121 100 130Z" fill="#f59e0b"/>
</svg>`

const iconSVG = (emoji) => `<span class="tile">${emoji}</span>`

const nav = (base, active, home) => {
  // 首页用页内锚点；其他页面必须回到 index.html 才能滚到对应区块
  const jump = (id) => (home ? '#' + id : base + 'index.html#' + id)
  const link = (href, label, key) =>
    `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`
  return `<a class="skip" href="#main">跳到主要内容</a>
<nav class="nav" aria-label="主导航">
  <div class="wrap">
    <a class="nav-brand" href="${base}index.html">${ICON_SHIELD}CQPUE资助政策</a>
    <div class="nav-links">
      ${link(home ? '#top' : base + 'index.html', '首页', 'home')}
      ${link(jump('policies'), '资助项目', 'policies')}
      ${link(jump('mindmap'), '体系全景', 'mindmap')}
      ${link(jump('schedule'), '全年日程', 'schedule')}
      ${link(base + 'center.html', '资助中心', 'center')}
      ${link(jump('author'), '关于作者', 'author')}
    </div>
    <a class="nav-cta" href="${SITE.apk.url}" title="仅支持安卓手机">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.6 9.5 19 7.1a.4.4 0 0 0-.7-.4l-1.4 2.4a8.4 8.4 0 0 0-3.9-.9 8.4 8.4 0 0 0-3.9.9L7.7 6.7a.4.4 0 0 0-.7.4l1.4 2.4A7 7 0 0 0 5 15h14a7 7 0 0 0-3.4-5.5ZM9 12.6a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm6 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6ZM5 16h14v3.5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V18h-4v1.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V16Z"/></svg>
      下载安卓版
    </a>
  </div>
</nav>`
}

const footer = (base) => `<footer>
  <div class="wrap">
    <div class="links">
      <a href="${base}index.html">首页</a>
      <a href="${base}center.html">资助中心业务全景</a>
      <a href="${base}privacy.html">隐私政策</a>
      <a href="${SITE.apk.url}">下载安卓版 v${SITE.apk.version}（仅安卓）</a>
      <a href="${base}policies/difficulty-assessment.html">从困难认定开始</a>
    </div>
    <div>本站由周泽维个人整理，<strong>完全免费、无广告、无商业用途</strong>，仅用于学习与研究。</div>
    <div>非重庆工程职业技术大学官方产品，内容仅供参考，具体政策以学校资助管理中心当年通知为准。本站内容仅对应本校执行口径，不适用于其他高校。</div>
    <div>数据更新：${SITE.updated} · 21 个资助项目 · 13 份政策依据</div>
  </div>
</footer>`

const WECHAT_LABELS = [
  { test: /gongzhonghao|公众号|mp-|account/i, title: '微信公众号', hint: SITE.wechat.id },
  { test: /dev|开发|personal/i, title: '开发者微信', hint: '扫码添加，注明来意' },
]

function contactBlock() {
  if (!wechatFiles.length) {
    return `<div class="contact">
      <div class="contact-head">联系开发者</div>
      <p class="contact-id">微信：<strong>${esc(SITE.wechat.id)}</strong></p>
    </div>`
  }
  const cards = wechatFiles
    .map((name) => {
      const hit = WECHAT_LABELS.find((l) => l.test.test(name))
      const title = hit ? hit.title : '微信'
      const hint = hit ? hit.hint : '扫码添加'
      return `<figure class="qr-card">
        <img src="assets/wechat/${encodeURI(name)}" alt="${esc(title)}二维码" width="168" height="168" loading="lazy">
        <figcaption><strong>${esc(title)}</strong><span>${esc(hint)}</span></figcaption>
      </figure>`
    })
    .join('')
  const hasMp = wechatFiles.some((n) => /gongzhonghao|公众号|mp-|account/i.test(n))
  return `<div class="contact">
    <div class="contact-head">联系开发者</div>
    <div class="qr-row">${cards}</div>
    ${hasMp ? '' : `<p class="contact-id">微信：<strong>${esc(SITE.wechat.id)}</strong></p>`}
  </div>`
}

const DEPS = `<div class="deps">
  <div class="deps-label">前置关系</div>
  <div class="deps-row">
    <a class="dep-from" href="policies/difficulty-assessment.html">家庭经济困难学生认定</a>
    <span class="dep-arrow">→</span>
    <a href="policies/national-grant.html">国家助学金</a>
    <a href="policies/encouragement-scholarship.html">国家励志奖学金</a>
    <a href="policies/tuition-waiver.html">学费减免</a>
    <a href="policies/freshman-subsidy.html">新生困难补助</a>
  </div>
  <p>这些项目都要求先通过困难认定；认定等级同时决定助学金的档次。</p>
</div>`

const layout = ({ title, description, base = '', active, home = false, body, extraHead = '' }) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000">
<link rel="icon" href="${base}assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${base}assets/site.css">
${extraHead}
</head>
<body id="top">
${nav(base, active, home)}
<div class="scope-bar">
  <div class="wrap">
    <span>只面向 <strong>重庆工程职业技术大学</strong></span>
    <span class="dot"></span>
    <span>不适用于其他高校 · 非官方，仅供参考</span>
    <a href="${home ? '#disclaimer' : base + 'index.html#disclaimer'}">免责声明</a>
  </div>
</div>
<main id="main">
${body}
</main>
${footer(base)}
<script src="${base}assets/site.js" defer></script>
</body>
</html>`

const card = (p, base) => `<a class="card" href="${base}policies/${p.id}.html">
  ${iconSVG(p.icon)}
  <div>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.subtitle)}</p>
    <span class="badge ${p.tag === '国家政策' ? 'n' : p.tag === '校内政策' ? 's' : 'soc'}">${esc(p.tag)}</span>
  </div>
</a>`

/* ------------------------------------------------------------------ 思维导图 */

/* 帕累托：月份节点降序柱状 + 累计占比曲线 */
function buildPareto(year, total) {
  const sorted = [...year].sort((a, b) => b.total - a.total)
  const W = 760, H = 300, padX = 18, top = 26, bottom = 58
  const bw = (W - padX * 2) / sorted.length
  const plotH = H - top - bottom
  const maxN = sorted[0].total
  let acc = 0
  const pts = []
  const bars = sorted
    .map((m, i) => {
      acc += m.total
      const pct = acc / total
      const x = padX + i * bw
      const bh = (m.total / maxN) * plotH
      const y = top + plotH - bh
      pts.push([x + bw / 2, top + plotH - pct * plotH])
      return (
        `<rect class="pf-bar" x="${(x + bw * 0.18).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" opacity="${(0.32 + 0.68 * (m.total / maxN)).toFixed(2)}"/>` +
        `<text class="pf-num" x="${(x + bw / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle">${m.total}</text>` +
        `<text class="pf-month" x="${(x + bw / 2).toFixed(1)}" y="${H - 34}" text-anchor="middle">${m.month}月</text>`
      )
    })
    .join('')

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const dots = pts
    .map((p, i) => {
      const cum = sorted.slice(0, i + 1).reduce((s, m) => s + m.total, 0)
      const pct = Math.round((cum / total) * 100)
      return `<circle class="pf-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6"/>` +
        (i === 3 ? `<text class="pf-cum" x="${p[0].toFixed(1)}" y="${(p[1] - 10).toFixed(1)}" text-anchor="middle">${pct}%</text>` : '')
    })
    .join('')

  const y80 = top + plotH - 0.8 * plotH
  return `<svg class="pareto-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="月份节点数帕累托图：按事项数降序排列，并标注累计占比">
    <line class="pf-guide" x1="${padX}" y1="${y80}" x2="${W - padX}" y2="${y80}"/>
    <text class="pf-guide-label" x="${W - padX}" y="${y80 - 6}" text-anchor="end">累计 80%</text>
    ${bars}
    <path class="pf-line" d="${line}"/>
    ${dots}
    <line class="pf-axis" x1="${padX}" y1="${top + plotH}" x2="${W - padX}" y2="${top + plotH}"/>
  </svg>`
}

function buildMindmap() {
  const ROW = 32
  const PAD_TOP = 40
  const X = { root: 24, cat: 220, grp: 432, leaf: 596 }
  const W = 900

  const leaves = []
  let y = PAD_TOP
  const catNodes = []

  for (const cat of MINDMAP) {
    const catItem = { label: cat.label, color: cat.color, x: X.cat, groups: [] }
    let firstLeafY = null
    let lastLeafY = null

    for (const g of cat.groups) {
      const grpItem = { label: g.label, x: X.grp, ys: [] }
      for (const id of g.ids) {
        const p = byId(id)
        if (!p) continue
        leaves.push({ id, title: p.title, color: cat.color, x: X.leaf, y })
        grpItem.ys.push(y)
        if (firstLeafY === null) firstLeafY = y
        lastLeafY = y
        y += ROW
      }
      grpItem.y = grpItem.ys.reduce((a, b) => a + b, 0) / grpItem.ys.length
      catItem.groups.push(grpItem)
      y += 8
    }
    catItem.y = (firstLeafY + lastLeafY) / 2
    catNodes.push(catItem)
    y += 26
  }

  const H = y - 6
  // 根节点放在整张图的正中，而不是两个分支的重心（否则会被更长的分支拽偏）
  const rootY = Math.round(H / 2)

  const curve = (x1, y1, x2, y2) => {
    const mx = (x1 + x2) / 2
    return `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  let out = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="学生资助体系思维导图：国家政策 11 项、校内政策 10 项">`
  out += `<style>
    .mm-root-bg{fill:#1d1d1f}
    .mm-root{font:700 17px var(--font,system-ui);fill:#fff}
    .mm-cat{font:700 15px var(--font,system-ui);fill:#fff}
    .mm-grp{font:600 13px var(--font,system-ui);fill:#86868b}
    .mm-leaf{font:400 13.5px var(--font,system-ui);fill:#1d1d1f}
    .mm-leaf:hover{fill:#0071e3}
    .mm-link{fill:none;stroke:#d2d2d7;stroke-width:1.4}
    .mm-link2{fill:none;stroke:#e0e0e5;stroke-width:1.1}
    @media (prefers-color-scheme: dark){
      .mm-root-bg{fill:#f5f5f7}
      .mm-root{fill:#1d1d1f}
      .mm-grp{fill:#86868b}.mm-leaf{fill:#f5f5f7}
      .mm-link{stroke:#3a3a3c}.mm-link2{stroke:#2c2c2e}
    }
  </style>`

  out += `<rect class="mm-root-bg" x="${X.root}" y="${rootY - 22}" width="152" height="44" rx="12"/>`
  out += `<text class="mm-root" x="${X.root + 18}" y="${rootY + 5}">学生资助体系</text>`

  for (const cat of catNodes) {
    out += `<path class="mm-link" d="${curve(X.root + 152, rootY, cat.x, cat.y - 22)}"/>`
    out += `<rect x="${cat.x}" y="${cat.y - 22}" width="138" height="44" rx="11" fill="${cat.color}"/>`
    out += `<text class="mm-cat" x="${cat.x + 16}" y="${cat.y + 5}">${esc(cat.label)}</text>`

    for (const g of cat.groups) {
      out += `<path class="mm-link2" d="${curve(cat.x + 138, cat.y, g.x, g.y)}"/>`
      out += `<text class="mm-grp" x="${g.x}" y="${g.y + 4.5}">${esc(g.label)}</text>`

      for (const ly of g.ys) {
        const leaf = leaves.find((l) => l.y === ly)
        if (!leaf) continue
        out += `<path class="mm-link2" d="${curve(g.x + 86, g.y, X.leaf - 10, ly)}"/>`
        out += `<a href="policies/${leaf.id}.html"><circle cx="${X.leaf - 10}" cy="${ly}" r="2.4" fill="${cat.color}" opacity=".65"/>`
        out += `<text class="mm-leaf" x="${X.leaf}" y="${ly + 4.5}">${esc(leaf.title)}</text></a>`
      }
    }
  }

  out += `</svg>`
  return out
}

/* ------------------------------------------------------------------ 页面 */

function renderIndex() {
  const mindmap = buildMindmap()

  const policySections = GROUPS.map(
    (g) => `<div class="group-block">
      <h3 style="font-size:22px;letter-spacing:-.02em;margin:48px 0 6px">${esc(g.title)} <span style="color:var(--text-3);font-weight:400;font-size:15px">${g.items.length} 项</span></h3>
      <p style="color:var(--text-2);font-size:14.5px;margin:0 0 20px">${esc(g.desc)}</p>
      <div class="grid">${g.items.map((p) => card(p, '')).join('')}</div>
    </div>`,
  ).join('')

  const year = buildYearSchedule()
  // 与月卡同口径：跨月段（如 2-3 月）在两个月中各计一次
  const STUDENT_TOTAL = year.reduce((n, m) => n + m.student.length, 0)
  const STAFF_TOTAL = year.reduce((n, m) => n + m.staff.length, 0)
  const RATIO = (STAFF_TOTAL / Math.max(1, STUDENT_TOTAL)).toFixed(1)
  const peak = year.reduce((a, b) => (b.total > a.total ? b : a), year[0])
  const totalNodes = year.reduce((n, m) => n + m.total, 0)

  const loadBar = year
    .map((m) => {
      const h = Math.max(8, Math.round((m.total / Math.max(1, peak.total)) * 100))
      const level = m.total >= peak.total * 0.75 ? 'high' : m.total >= peak.total * 0.4 ? 'mid' : 'low'
      return `<div class="lb-col" data-level="${level}">
        <span class="lb-count">${m.total}</span>
        <i style="height:${h}%"></i>
        <span class="lb-month">${m.month}月</span>
      </div>`
    })
    .join('')

  // 集中度指标
  const sortedYear = [...year].sort((a, b) => b.total - a.total)
  const busiest = sortedYear[0]
  const quietest = sortedYear[sortedYear.length - 1]
  const ratio = (busiest.total / Math.max(1, quietest.total)).toFixed(0)
  const top4 = sortedYear.slice(0, 4).reduce((s, m) => s + m.total, 0)
  const top4Pct = ((top4 / totalNodes) * 100).toFixed(0)

  const bizItems = BIZ_LIST.slice(2).filter((r) => r[0] && !String(r[0]).startsWith('说明'))
  const routine = bizItems.filter((r) => /常态|随时|按需|按月|动态|实时/.test(r[4] || ''))
  const routinePct = ((routine.length / bizItems.length) * 100).toFixed(0)

  const distRows2 = BIZ_DIST.slice(2).filter((r) => r[0] && !String(r[1]).startsWith('合计') && !String(r[0]).startsWith('说明'))
  const sortedCats = distRows2.map((d) => ({ name: d[1].replace(/^[一二三四五六七八九十]+、/, ''), n: Number(d[2]) })).sort((a, b) => b.n - a.n)
  const top3n = sortedCats.slice(0, 3).reduce((s, x) => s + x.n, 0)
  const top3Pct = ((top3n / bizItems.length) * 100).toFixed(0)

  const monthCards = year
    .map((m) => {
      const level = m.total >= peak.total * 0.75 ? 'high' : m.total >= peak.total * 0.4 ? 'mid' : 'low'
      // 按动作类型归并：同类动作在多个项目上重复，重复次数本身就是工作量
      const staffGroups = []
      for (const s of m.staff) {
        let g = staffGroups.find((x) => x.title === s.task)
        if (!g) { g = { title: s.task, n: 0, from: [] }; staffGroups.push(g) }
        g.n += 1
        if (s.kind === 'action' && s.note && !g.from.includes(s.note)) g.from.push(s.note)
      }
      staffGroups.sort((a, b) => b.n - a.n)
      const staffShown = staffGroups.slice(0, 6)
      const staffList = staffGroups.length
        ? `<ul>${staffShown
            .map(
              (g) =>
                `<li class="${g.from.length ? 'is-action' : ''}">${esc(g.title)}${g.n > 1 ? ` × ${g.n}` : ''}${
                  g.from.length ? `<span>${esc(g.from.slice(0, 3).join('、'))}${g.from.length > 3 ? ' 等' : ''}</span>` : ''
                }</li>`,
            )
            .join('')}${staffGroups.length > staffShown.length ? `<li class="more">另有 ${staffGroups.length - staffShown.length} 类动作</li>` : ''}</ul>`
        : '<p class="m-empty">常规经办：按月发放、动态认定、随时受理</p>'
      const st = m.student
      const shown = st.slice(0, 4)
      const studentList = st.length
        ? `<ul>${shown.map((s) => `<li>${esc(s.title)}${s.desc ? `<span>${esc(s.desc)}</span>` : ''}</li>`).join('')}${
            st.length > shown.length ? `<li class="more">另有 ${st.length - shown.length} 项</li>` : ''
          }</ul>`
        : '<p class="m-empty">本月无集中申请节点</p>'
      return `<article class="month-card" data-level="${level}">
        <header>
          <b>${m.month} 月</b>
          <span class="month-total">学生 ${m.student.length} · 中心 ${m.staff.length}</span>
        </header>
        <div class="m-block">
          <div class="m-label m-label--staff">背后的工作 · 中心侧环节</div>
          ${staffList}
        </div>
        <div class="m-block">
          <div class="m-label m-label--student">学生</div>
          ${studentList}
        </div>
      </article>`
    })
    .join('')

  const body = `
<header class="hero">
  <div class="wrap">
    <h1>把学生资助政策<br>讲清楚</h1>
    <p>21 个资助项目，从资格条件到材料清单，一站查完。</p>
    <p class="fresh-line">内容核对于 ${SITE.verifiedShort} · 建议 ${SITE.reviewBy}前复核</p>
    <div class="hero-actions">
      <a class="btn" href="#policies">浏览全部项目</a>
      <a class="btn ghost" href="#mindmap">看体系全景</a>
    </div>
    <div class="stats">
      <div><b>21</b><span>资助项目</span></div>
      <div><b>${CN_COUNT}</b><span>国家政策</span></div>
      <div><b>${SCH_COUNT}</b><span>校内政策</span></div>
      <div><b>${SOC_COUNT}</b><span>社会捐资</span></div>
      <div><b>13</b><span>政策依据</span></div>
    </div>
  </div>
</header>

<section id="download" class="dl-section">
  <div class="wrap dl-wrap">
    <div class="dl-text">
      <p class="eyebrow">安卓应用</p>
      <h2>装到手机上，离线也能查</h2>
      <p class="lede">21 个资助项目、办理流程、材料清单，全部内置在安装包里，断网也能看。</p>
      <ul class="dl-req">
        <li><span class="ok">✓</span>仅支持 <strong>安卓手机</strong>（${SITE.apk.platform}）</li>
        <li><span class="no">✕</span><strong>不支持 iPhone / iPad</strong>：苹果系统不识别 APK 安装包，无法安装</li>
        <li><span class="dot-i">·</span>首次安装需在系统设置里允许「安装未知来源应用」</li>
      </ul>
    </div>

    <div class="dl-card">
      <div class="dl-card-head">
        <span class="dl-icon">${ICON_SHIELD}</span>
        <div>
          <strong>CQPUE资助政策</strong>
          <span>安卓安装包</span>
        </div>
      </div>
      <dl class="dl-meta">
        <div><dt>版本</dt><dd>v${SITE.apk.version}（${SITE.apk.versionCode}）</dd></div>
        <div><dt>大小</dt><dd>${SITE.apk.size}</dd></div>
        <div><dt>系统</dt><dd>Android 7.0+</dd></div>
        <div><dt>费用</dt><dd>完全免费</dd></div>
      </dl>
      <a class="btn dl-btn" href="${SITE.apk.url}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>
        下载安卓安装包
      </a>
      <p class="dl-hash">SHA256 ${SITE.apk.sha256.slice(0, 24)}…</p>
      <p class="dl-alt">苹果手机没有对应版本。如需在手机上查看，请直接用浏览器访问本站。</p>
    </div>
  </div>
</section>

<section id="policies" class="alt">
  <div class="wrap">
    <p class="eyebrow">资助项目</p>
    <h2>按类别找到你要的项目</h2>
    <p class="lede">国家政策覆盖奖、助、贷、补、免；校内政策按学年与学期评定。不确定从哪开始，先看「家庭经济困难学生认定」——它是大多数资助的前置条件。</p>

    <div class="search-bar">
      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
      <input id="q" type="search" placeholder="搜索项目、金额、条件" aria-label="搜索资助项目">
      <button class="clr" id="qclear" aria-label="清除" hidden>✕</button>
    </div>

    <div id="results">
      ${policySections}
    </div>
    <div id="noresult" class="empty" hidden>没有找到相关项目，试试「国奖」「贷款」「勤工」。</div>
  </div>
</section>

<section id="mindmap">
  <div class="wrap">
    <p class="eyebrow">体系全景</p>
    <h2>一张图看懂资助体系</h2>
    <p class="lede">左边是国家政策，右边是校内政策。按用途归类，点任一节点可直接进入该项目。</p>
    <div class="map-frame">${mindmap}</div>
    <div class="map-hint">
      <span>点节点可直接进入对应项目</span>
      <a href="map.html">全屏查看 →</a>
    </div>
    ${DEPS}
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <p class="eyebrow">办理流程</p>
    <h2>一份申请，要过五道关</h2>
    <p class="lede">不同项目的细节不同，但主线一致：学生申请、班级评议、学院审核、学校审定、资金发放。每一级都有公示环节。</p>
    <ul class="flow">
      ${FLOW.map((f) => `<li><h4>${esc(f.t)}</h4><p>${esc(f.d)}</p></li>`).join('')}
    </ul>
  </div>
</section>

<section id="schedule">
  <div class="wrap">
    <p class="eyebrow">全年日程</p>
    <h2>学生看到的 ${STUDENT_TOTAL} 个节点，背后是 ${STAFF_TOTAL} 次经办</h2>
    <p class="lede">按学年排（9 月到次年 8 月）。学生能看见的 ${STUDENT_TOTAL} 个申请节点之外，资助中心还有 <strong>${STAFF_TOTAL} 项经办动作</strong>——平均每 1 个公开节点，对应 ${RATIO} 个看不见的环节。最密集的是 <strong>${peak.month} 月</strong>：学生 ${peak.student.length} 个节点、中心 ${peak.staff.length} 项动作。</p>
    <div class="load-bars">${loadBar}</div>
    <div class="month-grid">${monthCards}</div>
    <p class="schedule-note">口径说明：中心侧环节按项目归属到其办理月份，含后续发放、归档等环节；同一环节在多个项目上重复时按次数合并（如「全校公示 × 4」表示 4 个项目各需公示一次）。学生事项与中心环节相加不等于工时。</p>

    <div class="analysis">
      <h3>这份表能读出什么</h3>

      <div class="an-grid">
        <div class="an-card">
          <b>${ratio} 倍</b>
          <span>最忙与最闲的差距</span>
          <p>${busiest.month} 月 ${busiest.total} 个节点，${quietest.month} 月 ${quietest.total} 个。同样是"一个月"，工作量差一个数量级。</p>
        </div>
        <div class="an-card">
          <b>${top4Pct}%</b>
          <span>前 4 个月承担的节点占比</span>
          <p>9—12 月四个月占了全年三分之一的节点、一半以上的工作量，秋季学期是硬仗。</p>
        </div>
        <div class="an-card">
          <b>${routine.length} 项</b>
          <span>常态业务（${routinePct}%）</span>
          <p>按月发放、动态认定、随时受理这类事项每月都在跑，却不计入上面的节点数——实际工作量被低估。</p>
        </div>
        <div class="an-card">
          <b>${STAFF_TOTAL}</b>
          <span>项中心经办动作</span>
          <p>审批链里由中心自己完成的步骤，同名合并后 ${CENTER_ACTION_DISTINCT} 类：复核名单、组织公示、系统录入、上报、归档。是学生可见节点的 ${RATIO} 倍。</p>
        </div>
        <div class="an-card">
          <b>${top3Pct}%</b>
          <span>前 3 个门类占的业务比例</span>
          <p>${sortedCats.slice(0, 3).map((x) => x.name).join('、')}，三个门类 ${top3n} 项业务，几乎覆盖全部资金与合规动作。</p>
        </div>
      </div>

      <figure class="pareto">
        <figcaption>每月负荷（学生节点 + 中心动作）与累计占比</figcaption>
        ${buildPareto(year, totalNodes)}
        <p class="pf-note">前 4 个月累计 <strong>${((top4 / totalNodes) * 100).toFixed(1)}%</strong>，前 8 个月才到 80%。负荷按「学生节点 + 中心动作」计，仍是结构量，不等于工时。</p>
      </figure>

      <div class="an-conclusion">
        <strong>二八怎么看：</strong>把节点数当工作量代理，集中度并不极端——真正符合二八的是
        <em>风险与责任</em>：${bizItems.length} 项业务里，评审、资金发放、监督核查三个门类 ${top3n} 项占了三成不到，却承担了全部公示、发放与追回环节；而 ${routine.length} 项常态业务每天都在跑，却从不出现在"重要节点"里。
        这就是资助工作被低估的地方。
        <a class="an-link" href="center.html#workload">看完整的工作量说明 →</a>
      </div>
    </div>
  </div>
</section>

<section id="disclaimer">
  <div class="wrap narrow">
    <p class="eyebrow">适用范围</p>
    <h2>只适用于重庆工程职业技术大学</h2>
    <p class="lede">本站整理的国家与校内资助政策，对应的是重庆工程职业技术大学（原重庆工程职业技术学院）的执行口径。其他高校可以参照体例，但具体条件、比例、金额和办理时间以所在学校规定为准，不能直接套用。</p>

    <div class="disc-grid">
      <div class="disc-item">
        <h3>非官方资料</h3>
        <p>由周泽维个人独立整理，与学校无隶属关系，不是学校官方发布的产品。</p>
      </div>
      <div class="disc-item">
        <h3>仅供参考</h3>
        <p>全部内容仅供参考，不构成任何政策承诺或法律依据。因使用本站信息产生的后果由使用者自行承担。</p>
      </div>
      <div class="disc-item">
        <h3>以当年通知为准</h3>
        <p>政策随年度调整，具体条件、金额与办理时间以学校学生资助管理中心当年通知为准。</p>
      </div>
      <div class="disc-item">
        <h3>完全免费</h3>
        <p>无广告、无内购、无付费服务，不收集任何个人信息，也不提供付费咨询。</p>
      </div>
    </div>

    <p class="disc-foot">内容整理：周泽维　·　核对日期：${SITE.verified}　·　建议 ${SITE.reviewBy}前复核</p>
  </div>
</section>

<section id="author" class="alt">
  <div class="wrap author">
    <div>
      <p class="eyebrow">关于作者</p>
      <h2>周泽维</h2>
      <p>独立开发者。做这个项目的起因很简单：资助政策散落在十几个文件里，学生看不懂、辅导员也记不全。于是把它整理成一份可以随时查的结构化资料，先做成安卓应用，再搬到这里。</p>
      <p>项目完全公益：没有广告、没有内购、没有付费咨询，也不收集任何个人信息。如果你所在的学校也想做一份，欢迎直接拿去改。</p>
      <p><a href="${SITE.apk.url}">下载安卓版 v${SITE.apk.version}</a>　·　<a href="privacy.html">隐私政策</a>　·　<a href="tel:15736152295">15736152295</a></p>
      <p style="font-size:12.5px;color:var(--text-3);margin-top:6px">安装包 ${SITE.apk.size}　·　仅支持安卓手机，不支持 iPhone / iPad</p>
    </div>
    <div>
      <dl>
        <dt>项目</dt><dd>CQPUE资助政策</dd>
        <dt>归属</dt><dd>重庆工程职业技术大学</dd>
        <dt>范围</dt><dd>21 个资助项目 · 10 个月段日程</dd>
        <dt>依据</dt><dd>13 份国家与校内政策文件</dd>
        <dt>形态</dt><dd>安卓应用 ＋ 本网页</dd>
        <dt>费用</dt><dd>完全免费，无商业用途</dd>
        <dt>更新</dt><dd>${SITE.updated}</dd>
      </dl>
      ${contactBlock()}
    </div>
  </div>
</section>
`

  return layout({
    title: `${SITE.name} · ${SITE.tagline}`,
    description: SITE.desc,
    active: 'home',
    home: true,
    body,
  })
}

function renderPolicy(p, index) {
  const prev = policyCategories[(index - 1 + policyCategories.length) % policyCategories.length]
  const next = policyCategories[(index + 1) % policyCategories.length]

  const rules = p.rules || {}
  const positives = rules.prerequisites || []
  const negatives = [...(rules.exclusions || []), ...(rules.disqualifiers || [])]

  const cond = positives.length
    ? `<ul>${positives.map((r) => `<li><span class="mark y">✓</span><span>${esc(r)}</span></li>`).join('')}</ul>`
    : ''
  const neg = negatives.length
    ? `<div style="margin-top:16px"><h3 style="font-size:14px;color:var(--text-2);margin:0 0 10px">不能申请或会被取消资格</h3>
       <ul>${negatives.map((r) => `<li><span class="mark n">✕</span><span>${esc(r)}</span></li>`).join('')}</ul></div>`
    : ''

  const roles = p.approvalChain || []

  const chain = roles
    .map(
      (lvl, i) => `<article class="role-block" id="role-${i}" data-role="${i}">
      <header class="role-head">
        <span class="role-step">第 ${lvl.level} 级</span>
        <h3>${esc(lvl.role)}</h3>
        <span class="role-count">${lvl.steps.length} 项任务</span>
      </header>
      <ol class="role-steps">${lvl.steps
        .map((s, j) => `<li><span class="n">${j + 1}</span><div><h4>${esc(s.title)}</h4><p>${esc(s.desc)}</p></div></li>`)
        .join('')}</ol>
      ${lvl.publicity ? `<p class="role-pub">📣 ${esc(lvl.publicity)}</p>` : ''}
    </article>`,
    )
    .join('')

  const roleChips = roles
    .map(
      (lvl, i) => `<button class="role-chip" type="button" data-role="${i}">
        <span class="rc-icon">${esc(lvl.icon)}</span><span class="rc-name" title="${esc(lvl.role)}">${esc(lvl.role)}</span><span class="rc-lv">L${lvl.level}</span>
      </button>`,
    )
    .join('')

  const mats = (p.materials || [])
    .map(
      (m) => `<div><div><div class="nm">${esc(m.name)}</div>${m.note ? `<div class="nt">${esc(m.note)}</div>` : ''}</div>
      <span class="tag ${m.required ? 'r' : 'o'}">${m.required ? '必需' : '选交'}</span></div>`,
    )
    .join('')

  const tl = (p.timeline || [])
    .map((t) => `<li><div class="m">${esc(t.month)}</div><div class="e"><div>${esc(t.event)}</div></div></li>`)
    .join('')

  const related = relatedPolicies(p, policyCategories, 4).map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    reason: relationReason(p, r),
  }))

  const rel = related
    .map(
      (r) => `<a href="${r.id}.html"><div><div class="t">${esc(r.title)}</div><div class="s">${esc(r.subtitle)}</div></div><span class="why">${esc(r.reason)}</span></a>`,
    )
    .join('')

  const body = `
<div class="wrap">
  <div class="print-head">
    <div class="ph-title">${esc(p.title)} · ${SITE.name}</div>
    <div class="ph-meta">${SITE.url}/policies/${p.id}.html　·　内容核对于 ${SITE.verified}　·　打印时间 <span class="ph-date"></span></div>
  </div>

  <div class="page-head">
    <div class="crumb"><a href="../index.html">首页</a> / ${esc(p.tag)}</div>
    <div class="head-row">
      <span class="head-icon">${esc(p.icon)}</span>
      <div class="head-text">
        <h1>${esc(p.title)}</h1>
        <p class="sub">${esc(p.subtitle)}</p>
      </div>
      <button class="print-btn" type="button" onclick="window.print()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8V4h10v4"/><rect x="4" y="8" width="16" height="8" rx="2"/><path d="M7 16h10v4H7z"/></svg>
        打印
      </button>
    </div>
    <p class="scope-inline">仅适用于重庆工程职业技术大学 · 仅供参考，非官方</p>
    <div class="meta">
      <span>${esc(p.tag)}</span>
      ${p.source ? `<span>依据 ${esc(p.source)}</span>` : ''}
      <span class="fresh">内容核对于 ${SITE.verified}</span>
    </div>
  </div>

  <div class="role-bar" id="roles">
    <div class="role-bar-head">
      <span class="rb-label">你是这个流程里的哪一环</span>
      <span class="rb-hint">点一下，看这一级要做什么</span>
    </div>
    <div class="role-chips">${roleChips}</div>
    <div class="role-summary" id="roleSummary" aria-live="polite"></div>
  </div>

  <div class="layout">
    <div class="content">
      <div class="block" id="s1">
        <h2><span class="num">01</span>资格条件</h2>
        <div class="cond">${cond}${neg}</div>
      </div>

      <div class="block" id="s2">
        <h2><span class="num">02</span>政策要点</h2>
        <div class="prose">${marked.parse(p.overview || '')}</div>
      </div>

      <div class="block" id="s3">
        <h2><span class="num">03</span>办理流程 <span class="h2-note">共 ${roles.length} 级，从学生到学校</span></h2>
        <div class="roles">${chain}</div>
      </div>

      <div class="block" id="s4">
        <h2><span class="num">04</span>时间节点</h2>
        <ul class="timeline">${tl}</ul>
      </div>

      <div class="block" id="s5">
        <h2><span class="num">05</span>材料清单</h2>
        <div class="mats">${mats}</div>
      </div>

      ${rel ? `<div class="block" id="s6"><h2><span class="num">06</span>相关资助</h2><div class="rel">${rel}</div></div>` : ''}

      <div class="pager">
        <a href="${prev.id}.html">← ${esc(prev.title)}</a>
        <a href="${next.id}.html">${esc(next.title)} →</a>
      </div>
    </div>

    <aside class="toc">
      <strong>本页目录</strong>
      <a href="#s1">资格条件</a>
      <a href="#s2">政策要点</a>
      <a href="#s3">办理流程</a>
      <a href="#s4">时间节点</a>
      <a href="#s5">材料清单</a>
      ${rel ? '<a href="#s6">相关资助</a>' : ''}
    </aside>
  </div>
</div>`

  return layout({
    title: `${p.title} · ${SITE.name}`,
    description: `${p.title}：${p.subtitle}。${(p.description || '').slice(0, 80)}`,
    base: '../',
    active: 'policies',
    body,
  })
}

function renderMapPage(mindmap) {
  const body = `
<div class="wrap" style="padding:48px 0 80px">
  <p class="eyebrow">体系全景</p>
  <h2 style="margin-bottom:28px">学生资助体系思维导图</h2>
  <div class="map-frame">${mindmap}</div>
  <p style="margin-top:18px;font-size:13px;color:var(--text-3)">点击节点进入对应项目；带箭头的连线表示「困难认定」是这些项目的前置条件。</p>
</div>`
  return layout({
    title: `体系全景 · ${SITE.name}`,
    description: '学生资助体系思维导图：国家政策与校内政策的层级关系，以及困难认定作为前置条件的依赖关系。',
    active: 'mindmap',
    body,
  })
}

function renderCenter() {
  const bizRows = BIZ_LIST.slice(2).filter((r) => r[0] && !String(r[0]).startsWith('说明'))
  const distRows = BIZ_DIST.slice(2).filter((r) => r[0] && !String(r[1]).startsWith('合计') && !String(r[0]).startsWith('说明'))
  const rhythmRows = RHYTHM_ROWS
  const riskRows = BIZ_RISK.slice(2).filter((r) => r[0] && !String(r[0]).startsWith('说明'))
  const archiveRows = BIZ_ARCHIVE.slice(2).filter((r) => r[0] && !String(r[0]).startsWith('说明'))

  // 按门类归并业务
  const groups = []
  for (const r of bizRows) {
    let g = groups.find((x) => x.name === r[1])
    if (!g) { g = { name: r[1], items: [] }; groups.push(g) }
    const item = { no: r[0], title: r[2], desc: r[3], freq: r[4], basis: r[5], store: r[6] }
    // 学习单项奖学金是一个总称，含三项子奖，原文单列容易误解为一种
    if (String(r[2]).includes('学习单项奖学金')) {
      item.title = '学习单项奖学金（含三个子项）'
      item.desc =
        '学习优胜：每学期一次，每人 1000 元，班级加权平均分第一名（含并列，无补考）；' +
        '学习进步：每学期一次，每人 600 元，每班排名进步最多的 2 名且进步 10 名及以上；' +
        '交换生专项：从本人缴纳学费中提取，按交流学习时间对应本学年学费按月计算'
    }
    g.items.push(item)
  }
  const distMap = {}
  for (const d of distRows) distMap[d[1]] = { count: d[2], share: Number(d[3]) }

  const chips =
    `<button class="cat-chip is-on" type="button" data-cat="all">全部<span>${bizRows.length}</span></button>` +
    groups
      .map((g, i) => `<button class="cat-chip" type="button" data-cat="${i}">${esc(g.name.replace(/^[一二三四五六七八九十]+、/, ''))}<span>${g.items.length}</span></button>`)
      .join('')

  const groupHtml = groups
    .map(
      (g, i) => `<div class="biz-group" id="cat-${i}" data-cat="${i}">
      <h3 class="biz-group-head">${esc(g.name)}<span>${g.items.length} 项</span></h3>
      ${g.items
        .map(
          (it) => `<article class="biz-row">
          <div class="biz-no">${esc(it.no)}</div>
          <div class="biz-body">
            <div class="biz-title">${esc(it.title.replace(/^\d+\s*/, ''))}</div>
            <p class="biz-desc">${esc(it.desc)}</p>
            <div class="biz-meta">
              <span class="biz-freq">${esc(it.freq)}</span>
              ${it.basis ? `<span class="biz-basis">依据 ${esc(it.basis)}</span>` : ''}
            </div>
          </div>
        </article>`,
        )
        .join('')}
    </div>`,
    )
    .join('')

  const distHtml = distRows
    .map((d, i) => {
      const name = d[1].replace(/^[一二三四五六七八九十]+、/, '')
      const share = (Number(d[3]) * 100).toFixed(1)
      return `<a class="cat-card" href="#cat-${i}">
      <div class="cat-name">${esc(name)}</div>
      <div class="cat-num"><strong>${esc(d[2])}</strong> 项<span>${share}%</span></div>
      <div class="cat-bar"><i style="width:${share}%"></i></div>
    </a>`
    })
    .join('')

  const rhythmHtml = rhythmRows
    .map((r) => `<li><div class="m">${esc(r[0])}</div><div class="e"><div>${esc(r[1])}</div><span class="rhythm-cat">${esc(r[2])}</span>${r[3] ? `<span class="rhythm-note">${esc(r[3])}</span>` : ''}</div></li>`)
    .join('')

  const riskHtml = riskRows
    .map((r) => `<div class="risk-item">
      <div class="risk-cat">${esc(r[0])}</div>
      <p class="risk-desc">${esc(r[1])}</p>
      <div class="risk-fix"><span>防控</span>${esc(r[2])}</div>
    </div>`)
    .join('')

  // 工作量指标
  const COMPLIANCE = /审核|复核|核对|公示|归档|上报|录入|统计|核查|自查|报送|留痕|追回|校验/
  const complianceCount = bizRows.filter((r) => COMPLIANCE.test(r[3] || '')).length
  const compliancePct = ((complianceCount / bizRows.length) * 100).toFixed(0)
  const routineCount = bizRows.filter((r) => /常态|随时|按需|按月|动态|实时/.test(r[4] || '')).length
  const routinePct = ((routineCount / bizRows.length) * 100).toFixed(0)

  const body = `
<div class="wrap">
  <div class="page-head">
    <div class="crumb"><a href="index.html">首页</a> / 资助中心</div>
    <h1>学生资助管理中心 · 业务全景</h1>
    <p class="sub">10 个门类、${bizRows.length} 项业务，以及全年工作节奏与风险防控要点</p>
    <p class="scope-inline">本页只适用于重庆工程职业技术大学，不适用于其他高校</p>
    <div class="meta">
      <span>校内业务梳理</span>
      <span>数据截至 2026-10-14</span>
      <span>面向资助工作者</span>
    </div>
  </div>

  <div class="center-stats">
    <div><b>${distRows.length}</b><span>业务门类</span></div>
    <div><b>${bizRows.length}</b><span>业务事项</span></div>
    <div><b>${rhythmRows.length}</b><span>全年节点</span></div>
    <div><b>${riskRows.length}</b><span>风险防控点</span></div>
  </div>

  <section class="workload" id="workload">
    <p class="eyebrow">工作量说明</p>
    <h2>资助工作不只是"收表、发钱"</h2>
    <p class="lede">把 ${bizRows.length} 项业务的流程拆开看：${complianceCount} 项（${compliancePct}%）的日常就是审核、公示、核对、归档。下面这些数字，都是可以逐项核对的。</p>

    <div class="wl-grid">
      <div class="wl-card"><b>211</b><span>审批步骤</span><p>21 条审批链合计 211 步，平均每个项目 10 步，每一步都要会议记录、签字与留痕。</p></div>
      <div class="wl-card"><b>80</b><span>处公示要求</span><p>21 个政策共 80 处公示，累计 278 个公示日；班级 2 个工作日、学院 3 个、全校 5 个，逐级公示并拍照归档。</p></div>
      <div class="wl-card"><b>4</b><span>个系统</span><p>全国学生资助管理信息系统、重庆统发系统、智慧职教平台、全国征兵网，同一批数据要重复录入与双向核对。</p></div>
      <div class="wl-card"><b>53</b><span>个归档文件夹</span><p>评审材料、发放清册、公示影像、会议记录分册归档，纸质与电子双套留存，检查时以归档材料为佐证。</p></div>
      <div class="wl-card"><b>${routineCount}</b><span>项常态业务（${routinePct}%）</span><p>按月发放、动态认定、随时受理投诉举报——每月都在跑，却从不出现在"重要节点"里。</p></div>
      <div class="wl-card"><b>10</b><span>条风险防控点</span><p>资格审核、重复资助、学籍异动、信息安全、资金安全……每条背后都是一套核验动作，漏一项就要追回。</p></div>
    </div>

    <h3 class="wl-sub">一件奖助学金，从交表到到账要过多少手</h3>
    <div class="wl-flow">
      <span>学生提交</span><i>→</i><span>班级评议</span><i>→</i><span>辅导员核实</span><i>→</i><span>学院审核</span><i>→</i><span>学院公示</span><i>→</i><span>中心复核</span><i>→</i><span>领导小组审定</span><i>→</i><span>校长办公会</span><i>→</i><span>全校公示</span><i>→</i><span>财务发放</span><i>→</i><span>系统录入</span><i>→</i><span>材料归档</span>
    </div>

    <h3 class="wl-sub">被看见的，和实际发生的</h3>
    <div class="wl-compare">
      <div class="wl-row wl-head"><div>外面看到的</div><div>实际要做的</div></div>
      <div class="wl-row"><div>收一张申请表</div><div>核验困难认定等级、成绩排名、贷款记录、学籍状态、处分情况，任一项不符都要退回重来</div></div>
      <div class="wl-row"><div>盖章走流程</div><div>平均 10 个审批步骤，每一级都要有会议记录、签字和留痕，任何一环缺失都算程序瑕疵</div></div>
      <div class="wl-row"><div>公示 5 天</div><div>21 个政策共 80 处公示要求，三级公示天数分别累计，公示照片、异议处理记录全部归档</div></div>
      <div class="wl-row"><div>发一笔钱</div><div>全国系统与重庆统发系统双录入，银行流水逐笔核对，重复发放、学籍异动当月就要停发或追回</div></div>
      <div class="wl-row"><div>年底交个表</div><div>53 个归档文件夹、纸质电子双套、10 条风险防控点逐项自查，巡视审计时逐条对账</div></div>
    </div>

    <div class="wl-close">
      <p>这些工作没有一件能省：少一级公示是程序违规，晚一天上报是通报，错一个名单要全额追回。</p>
      <p>做对了，是"应该的"；做慢了，是"怎么还没好"；出错了，是"谁负责"。</p>
      <p>把体量写出来，不是抱怨，只是希望"资助工作"这四个字，被看见得准确一点。</p>
      <p class="wl-note">以上数字来自本校业务梳理（数据截至 2026-10-14），用于说明工作量结构，不针对任何部门或个人。如有出入，以学校当年文件为准。</p>
    </div>
  </section>

  <div class="block" id="c1">
    <h2><span class="num">01</span>十个门类</h2>
    <div class="cat-grid">${distHtml}</div>
  </div>

  <div class="block" id="c2">
    <h2><span class="num">02</span>${bizRows.length} 项业务清单</h2>
    <div class="cat-chips">${chips}</div>
    <div class="biz-wrap">${groupHtml}</div>
  </div>

  <div class="block" id="c3">
    <h2><span class="num">03</span>全年工作节奏</h2>
    <p class="block-lede">按学年周期梳理的常规节奏，供年度计划编制与任务提醒参考；具体时间以当年上级通知和校内便笺为准。</p>
    <ul class="timeline rhythm">${rhythmHtml}</ul>
  </div>

  <div class="block" id="c4">
    <h2><span class="num">04</span>风险与防控</h2>
    <p class="block-lede">来自历年巡视审计、清退统计与重复发放追回记录，评审与发放前应逐项对照。</p>
    <div class="risk-grid">${riskHtml}</div>
  </div>

  <div class="block" id="c5">
    <h2><span class="num">05</span>材料归档</h2>
    <p class="block-lede">业务材料按门类分册归档，纸质与电子双套留存。当前工作区共 ${archiveRows.length} 个已编号业务文件夹，另有历史备份目录单独存放。</p>
    <div class="archive-note">
      评审材料、发放清册、公示影像、会议记录均需留痕，检查时以归档材料为佐证。
    </div>
  </div>

  <p class="center-foot">数据来源：学生资助管理中心业务全景总表（G 盘全目录结构实地扫描，2026-10-14）。业务依据：财教〔2021〕310号、渝财规〔2022〕6号、渝财教〔2024〕172号及校本级制度。</p>
</div>`

  return layout({
    title: `资助中心业务全景 · ${SITE.name}`,
    description: '重庆工程职业技术大学学生资助管理中心 10 大门类、47 项业务的全景梳理，含全年工作节奏与风险防控要点。',
    active: 'center',
    body,
  })
}

function renderPrivacy() {
  const md = `本站不收集任何个人信息，不使用 Cookie，不接入统计或广告服务。所有页面均为静态文件，托管在 GitHub Pages 上。

开发者：周泽维（个人开发者，非学校官方）　联系电话：15736152295

本站内容依据学校及国家、重庆市公开的资助政策文件整理，**非学校官方发布**。政策可能随年度调整，具体条件、金额与办理时间**以学校学生资助管理中心当年通知为准**。本站不构成任何政策承诺或法律依据。

完整隐私政策（含安卓应用端说明）见应用内「关于 → 隐私政策」页面，要点如下：

- 不收集、不上传、不存储任何个人信息
- 无账号、无登录、无支付、无广告、无内购
- 不使用 Cookie 与任何追踪技术
- 不接入第三方统计、推送、广告或崩溃上报 SDK
- 安卓应用不申请相机、麦克风、通讯录、位置、短信、存储等敏感权限

生效日期：2026 年 10 月 24 日`

  const body = `
<div class="wrap" style="padding:48px 0 96px;max-width:760px">
  <p class="eyebrow">隐私</p>
  <h2>隐私政策</h2>
  <div class="prose" style="margin-top:24px">${marked.parse(md)}</div>
</div>`
  return layout({ title: `隐私政策 · ${SITE.name}`, description: '本站不收集任何个人信息，无 Cookie、无统计、无广告。', body })
}

function render404() {
  const body = `
<div class="wrap" style="padding:120px 0;text-align:center">
  <h1 style="font-size:clamp(40px,7vw,72px);letter-spacing:-.03em;margin:0 0 12px">页面走丢了</h1>
  <p style="color:var(--text-2);margin:0 0 28px">这个地址没有对应的内容，可能是链接过期了。</p>
  <a class="btn" href="index.html">返回首页</a>
</div>`
  return layout({ title: '页面未找到 · CQPUE资助政策', description: '页面不存在', body })
}

/* ------------------------------------------------------------------ 输出 */

rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'assets'), { recursive: true })
mkdirSync(join(OUT, 'policies'), { recursive: true })

// 二维码图片：有就复制，没有就跳过（绝不渲染占位图或假二维码）
const wechatSrc = SITE.wechat.dir
const wechatFiles = []
if (existsSync(wechatSrc)) {
  for (const name of readdirSync(wechatSrc)) {
    if (!/\.(png|jpe?g|webp|svg)$/i.test(name)) continue
    const from = join(wechatSrc, name)
    const to = join(OUT, 'assets/wechat', name)
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)
    wechatFiles.push(name)
  }
}
wechatFiles.sort()

writeFileSync(join(OUT, 'assets/site.css'), CSS, 'utf8')
writeFileSync(join(OUT, 'assets/icon.svg'), ICON_SHIELD, 'utf8')
writeFileSync(join(OUT, 'assets/site.js'), SITE_JS, 'utf8')
writeFileSync(join(OUT, '.nojekyll'), '', 'utf8')
writeFileSync(join(OUT, 'index.html'), renderIndex(), 'utf8')
writeFileSync(join(OUT, '404.html'), render404(), 'utf8')
writeFileSync(join(OUT, 'privacy.html'), renderPrivacy(), 'utf8')
writeFileSync(join(OUT, 'map.html'), renderMapPage(buildMindmap()), 'utf8')
writeFileSync(join(OUT, 'center.html'), renderCenter(), 'utf8')

policyCategories.forEach((p, i) => {
  writeFileSync(join(OUT, 'policies', `${p.id}.html`), renderPolicy(p, i), 'utf8')
})

const pages = ['index.html', 'map.html', 'center.html', 'privacy.html'].concat(
  policyCategories.map((p) => `policies/${p.id}.html`),
)

writeFileSync(
  join(OUT, 'robots.txt'),
  SITE.url ? `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n` : 'User-agent: *\nAllow: /\n',
  'utf8',
)

if (SITE.url) {
  writeFileSync(
    join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((u) => `  <url><loc>${SITE.url}/${u}</loc></url>`).join('\n')}
</urlset>`,
    'utf8',
  )
}

console.log(`站点已生成：${OUT}/`)
console.log(`  首页 1 · 政策页 ${policyCategories.length} · 导图页 1 · 资助中心 1 · 隐私 1 · 404 1`)
